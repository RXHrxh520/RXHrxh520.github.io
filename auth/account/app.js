/* 个人中心 */

const $ = s => document.querySelector(s);
const API = "/api";

function msg(el, t, ok) {
  el.textContent = t || "";
  el.className = "msg" + (t ? (ok ? " ok" : " err") : "");
}

(async () => {
  const r = await fetch(API + "/me", { credentials: "same-origin" }).catch(() => null);
  if (!r) return fail();
  if (r.status === 403) {
    const d = await r.json().catch(() => ({}));
    if (d.banned) return showBan(d.ban);
  }
  const d = await r.json().catch(() => ({}));
  if (!d.user) return location.href = "/?next=/account/";
  render(d.user);
})();

function fail() {
  $("#loading").innerHTML = '<p style="font-size:13px;color:var(--danger)">读取失败，请刷新重试</p>';
}

function showBan(ban) {
  $("#loading").innerHTML = `<p style="font-size:13px;color:var(--danger)">账号已被封禁</p>
    <p style="font-size:12.5px;color:#606a78;line-height:1.7">原因：${ban.reason || "未填写"}<br>时间：${fmt(ban.start_at)} → ${fmt(ban.end_at)}</p>`;
}

function render(u) {
  $("#loading").hidden = true;
  $("#main").hidden = false;
  $("#name").textContent = u.name;
  $("#email").textContent = u.email;
  $("#uid").textContent = u.uid;
  $("#role").textContent = u.is_admin ? "管理员" : "成员";
  $("#nname").value = u.name;
  $("#nava").value = u.avatar || "";
  paint(u.avatar);
  window.__user = u;
}

function paint(url) {
  const img = $("#avatar");
  if (url && /^https?:\/\//i.test(url)) img.src = url; else img.removeAttribute("src");
  img.onerror = () => img.removeAttribute("src");
  img.style.background = "var(--soft)";
}

$("#saveProfile").addEventListener("click", async () => {
  const m = $("#pmsg");
  const r = await fetch(API + "/profile", {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: $("#nname").value.trim(), avatar: $("#nava").value.trim() }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) return msg(m, d.error || "保存失败");
  msg(m, "已保存", true);
  $("#name").textContent = $("#nname").value.trim();
  paint($("#nava").value.trim());
});

$("#savePwd").addEventListener("click", async () => {
  const m = $("#wmsg");
  const r = await fetch(API + "/password", {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ old: $("#old").value, next: $("#next").value }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) return msg(m, d.error || "修改失败");
  msg(m, "密码已更新，其他设备已下线", true);
  $("#old").value = ""; $("#next").value = "";
});

$("#logout").addEventListener("click", async () => {
  await fetch(API + "/logout", { method: "POST", credentials: "same-origin" });
  location.href = "/";
});

function fmt(t) {
  if (!t) return "—";
  try { return new Date(t).toLocaleString("zh-CN", { hour12: false }); } catch { return t; }
}
