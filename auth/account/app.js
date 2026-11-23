/* 账号中心 v2 */
(() => {
  const $ = s => document.querySelector(s);
  const API = "/api";
  const DEFAULT_AVA = "https://www.rxh.asia/assets/default-avatar.svg";
  let me = null;

  const msg = (el, t, ok) => {
    el.textContent = t || "";
    el.className = "msg" + (t ? (ok ? " ok" : " err") : "");
  };

  (async () => {
    let r;
    try { r = await fetch(API + "/me", { credentials: "same-origin", cache: "no-store" }); }
    catch { return ($("#loading").textContent = "读取失败，请刷新重试"); }
    if (r.status === 403) {
      const d = await r.json().catch(() => ({}));
      if (d.banned) return showBan(d.ban);
    }
    const d = await r.json().catch(() => ({}));
    if (!d.user) return (location.href = "/?next=/account/");
    me = d.user;
    render();
  })();

  function showBan(ban) {
    $("#loading").innerHTML = `<div style="text-align:center">
      <div style="font-size:15px;color:#ff6470;font-weight:600">账号已被封禁</div>
      <p style="font-size:12.5px;color:#98a2bd;line-height:1.8;margin-top:10px">原因：${esc(ban.reason || "未填写")}<br>时间：${fmt(ban.start_at)} → ${fmt(ban.end_at)}</p>
      <a href="https://auth.rxh.asia/appeal/" style="display:inline-flex;margin-top:14px;padding:9px 16px;border-radius:10px;background:linear-gradient(120deg,#ff7ab8,#b45cff);color:#170f22;font-size:13px;font-weight:600;text-decoration:none">提交申诉</a>
      <p style="font-size:11.5px;color:#98a2bd;margin-top:10px">申诉需填写联系邮箱与理由（最多 300 字），7 天后自动清除。</p></div>`;
  }

  function render() {
    $("#loading").hidden = true;
    $("#app").hidden = false;
    $("#pname").textContent = me.name || "未命名";
    $("#pmail").textContent = me.email || "";
    $("#uid").textContent = me.uid;
    $("#uid2").textContent = me.uid;
    $("#email2").textContent = me.email || "—";
    $("#role").lastChild.textContent = " " + (me.is_admin ? "管理员" : "成员");
    $("#role2").textContent = me.is_admin ? "管理员" : "普通成员";
    $("#nname").value = me.name || "";
    $("#nava").value = me.avatar || "";
    paintAvatar(me.avatar);
    if (me.is_admin) {
      const a = document.createElement("a");
      a.href = "https://admin.rxh.asia/";
      a.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-shield"/></svg>管理后台';
      $("#app .mini").appendChild(a);
    }
  }

  function paintAvatar(url) {
    const img = $("#ava");
    img.src = url && /^https?:\/\//i.test(url) ? url : DEFAULT_AVA;
    img.onerror = () => { img.onerror = null; img.src = DEFAULT_AVA; };
  }

  /* 标签 */
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
    ["profile", "security", "account"].forEach(p => $("#p-" + p).hidden = p !== t.dataset.p);
  }));

  $("#copyUid").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(me.uid); $("#copyUid").title = "已复制"; }
    catch { }
  });

  $("#saveProfile").addEventListener("click", async () => {
    const m = $("#pmsg");
    $("#saveProfile").disabled = true;
    const r = await fetch(API + "/profile", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: $("#nname").value.trim(), avatar: $("#nava").value.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    $("#saveProfile").disabled = false;
    if (!d.ok) return msg(m, d.error || "保存失败");
    me.name = $("#nname").value.trim(); me.avatar = $("#nava").value.trim();
    $("#pname").textContent = me.name; paintAvatar(me.avatar);
    msg(m, "已保存", true);
  });

  $("#resetAvatar").addEventListener("click", async () => {
    $("#nava").value = "";
    $("#saveProfile").click();
  });

  $("#savePwd").addEventListener("click", async () => {
    const m = $("#wmsg");
    const old = $("#old").value, next = $("#next").value;
    if (!old || next.length < 8) return msg(m, "请填写原密码，新密码至少 8 位");
    $("#savePwd").disabled = true;
    const r = await fetch(API + "/password", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ old, next }),
    });
    const d = await r.json().catch(() => ({}));
    $("#savePwd").disabled = false;
    if (!d.ok) return msg(m, d.error || "修改失败");
    $("#old").value = ""; $("#next").value = "";
    msg(m, "密码已更新，其他设备已下线", true);
  });

  $("#deleteAccount").addEventListener("click", async () => {
    const m = $("#dmsg");
    if ($("#delWord").value.trim() !== "注销") return msg(m, "请输入「注销」两个字确认");
    if (!$("#delPwd").value) return msg(m, "请输入登录密码");
    $("#deleteAccount").disabled = true;
    const r = await fetch(API + "/account/delete", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("#delPwd").value }),
    });
    const d = await r.json().catch(() => ({}));
    $("#deleteAccount").disabled = false;
    if (!d.ok) return msg(m, d.error || "注销失败");
    msg(m, "账号已注销，即将返回首页…", true);
    setTimeout(() => (location.href = "https://www.rxh.asia/"), 900);
  });

  $("#logout").addEventListener("click", async () => {
    await fetch(API + "/logout", { method: "POST", credentials: "same-origin" }).catch(() => { });
    location.href = "/";
  });

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function fmt(t) { if (!t) return "—"; try { return new Date(t).toLocaleString("zh-CN", { hour12: false }); } catch { return t; } }
})();
