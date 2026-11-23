/* 管理后台 */

const $ = s => document.querySelector(s);
const API = "/api";
let tsToken = "", tsWidget = null;

function msg(el, t, ok) { el.textContent = t || ""; el.className = "msg" + (t ? (ok ? " ok" : " err") : ""); }
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = t => { if (!t) return "—"; try { return new Date(t).toLocaleString("zh-CN", { hour12: false }); } catch { return t; } };
const toISO = v => v ? new Date(v).toISOString() : "";

/* Turnstile */
function whenTs(timeout = 8000) {
  return new Promise((res, rej) => {
    if (window.turnstile) return res(window.turnstile);
    const t0 = Date.now();
    (function tick() {
      if (window.turnstile) return res(window.turnstile);
      if (Date.now() - t0 > timeout) return rej(new Error("timeout"));
      setTimeout(tick, 120);
    })();
  });
}
(async () => {
  try {
    const ts = await whenTs();
    tsWidget = ts.render("#tsBox", {
      sitekey: window.TURNSTILE_SITEKEY,
      callback: t => { tsToken = t; $("#aLogin").disabled = false; },
      "expired-callback": () => { tsToken = ""; $("#aLogin").disabled = true; },
      "error-callback": () => { tsToken = ""; $("#aLogin").disabled = true; },
    });
  } catch { msg($("#lmsg"), "人机验证组件加载失败，请刷新"); }
})();

/* 登录 */
$("#aLogin").addEventListener("click", async () => {
  const btn = $("#aLogin");
  btn.disabled = true; btn.textContent = "登录中…";
  try {
    const r = await fetch(API + "/login", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: $("#a").value.trim(), password: $("#b").value, turnstile: tsToken }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "登录失败");
    if (!d.user.is_admin) {
      await fetch(API + "/logout", { method: "POST", credentials: "same-origin" });
      throw new Error("该账号不是管理员");
    }
    enter(d.user);
  } catch (e) { msg($("#lmsg"), e.message); }
  finally { btn.textContent = "登录"; if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget); tsToken = ""; }
});

function enter(u) {
  $("#loginCard").classList.add("hide");
  $("#console").classList.remove("hide");
  $("#who").textContent = u.name;
  $("#whoUid").textContent = u.uid;
  loadAll();
}

/* 标签 */
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
  ["users", "invites", "notice", "self"].forEach(p => $("#p-" + p).classList.toggle("hide", p !== t.dataset.p));
}));

/* 数据加载 */
async function get(p) { const r = await fetch(API + p, { credentials: "same-origin" }); return r.json(); }
async function post(p, body) {
  const r = await fetch(API + p, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  return r.json();
}

async function loadAll() {
  const o = await get("/admin/overview");
  $("#sUsers").textContent = o.users ?? "—";
  $("#sBanned").textContent = o.banned ?? "—";
  $("#sSessions").textContent = o.sessions ?? "—";
  $("#sInvites").textContent = o.invites ?? "—";
  loadUsers(); loadInvites(); loadNotices();
}

async function loadUsers() {
  const d = await get("/admin/users");
  const bans = new Map((d.bans || []).map(b => [b.uid, b]));
  $("#usersBody").innerHTML = (d.users || []).map(u => {
    const ban = bans.get(u.uid);
    return `<tr>
      <td class="mono">${esc(u.uid)}</td>
      <td>${esc(u.name)}<br><span class="sub">${esc(u.email)}</span></td>
      <td>${u.status === "active" ? '<span class="pill ok">正常</span>' : '<span class="pill bad">停用</span>'}${u.is_admin ? ' <span class="pill">管理员</span>' : ""}</td>
      <td>${ban ? `<span class="pill bad">封禁中</span><br><span class="sub">${esc(ban.reason || "")}<br>${fmt(ban.start_at)} → ${fmt(ban.end_at)}</span>` : '<span class="sub">—</span>'}</td>
      <td><button class="btn sm ghost" data-uid="${esc(u.uid)}" data-act="fill">填入封禁</button>
          <button class="btn sm ghost" data-uid="${esc(u.uid)}" data-act="unban">解封</button></td>
    </tr>`;
  }).join("");
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const uid = b.dataset.uid;
  if (b.dataset.act === "fill") {
    $("#bUid").value = uid;
    const now = new Date(), end = new Date(Date.now() + 7 * 86400000);
    $("#bStart").value = toLocal(now); $("#bEnd").value = toLocal(end);
    return;
  }
  if (b.dataset.act === "unban") {
    const d = await post("/admin/unban", { uid });
    msg($("#bmsg"), d.ok ? "已解封" : (d.error || "失败"), !!d.ok);
    loadUsers();
  }
  if (b.dataset.act === "invdel") {
    const d = await post("/admin/invite/delete", { code: b.dataset.code });
    msg($("#imsg"), d.ok ? "已删除" : (d.error || "失败"), !!d.ok);
    loadInvites();
  }
  if (b.dataset.act === "ntoggle") {
    const d = await post("/admin/notice/toggle", { id: Number(b.dataset.id), active: b.dataset.on === "1" ? 1 : 0 });
    msg($("#nmsg"), d.ok ? "已更新" : (d.error || "失败"), !!d.ok);
    loadNotices();
  }
});

function toLocal(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* 封禁 */
$("#doBan").addEventListener("click", async () => {
  const body = {
    uid: $("#bUid").value.trim(),
    start: toISO($("#bStart").value) || new Date().toISOString(),
    end: toISO($("#bEnd").value),
    reason: $("#bReason").value.trim(),
  };
  if (!body.uid || !body.end) return msg($("#bmsg"), "需要填写用户 ID 与结束时间");
  const d = await post("/admin/ban", body);
  msg($("#bmsg"), d.ok ? "已封禁，该用户所有登录态已作废" : (d.error || "失败"), !!d.ok);
  loadUsers();
});

$("#doUnban").addEventListener("click", async () => {
  const uid = $("#bUid").value.trim();
  if (!uid) return msg($("#bmsg"), "请填写用户 ID");
  const d = await post("/admin/unban", { uid });
  msg($("#bmsg"), d.ok ? "已解除封禁" : (d.error || "失败"), !!d.ok);
  loadUsers();
});

/* 邀请码 */
$("#doInvite").addEventListener("click", async () => {
  const body = { uses: Number($("#iUses").value || 1), code: $("#iCode").value.trim(), expires: $("#iExp").value ? new Date($("#iExp").value).toISOString() : "" };
  const d = await post("/admin/invite", body);
  msg($("#imsg"), d.ok ? `已生成 ${d.code}（可用 ${d.uses} 次）` : (d.error || "失败"), !!d.ok);
  loadInvites();
});

async function loadInvites() {
  const d = await get("/admin/invites");
  $("#invBody").innerHTML = (d.items || []).map(i => `<tr>
    <td class="mono">${esc(i.code)}</td>
    <td>${i.uses} / ${i.max_uses}</td>
    <td>${i.expires_at ? fmt(i.expires_at) : "长期"}</td>
    <td><button class="btn sm ghost" data-act="invdel" data-code="${esc(i.code)}">删除</button></td>
  </tr>`).join("") || '<tr><td colspan="4" class="sub">还没有邀请码</td></tr>';
}

/* 公告 */
$("#doNotice").addEventListener("click", async () => {
  const body = {
    text: $("#nText").value.trim(),
    active: $("#nActive").checked,
    start: toISO($("#nStart").value),
    end: toISO($("#nEnd").value),
  };
  if (!body.text) return msg($("#nmsg"), "公告内容不能为空");
  const d = await post("/admin/notice", body);
  msg($("#nmsg"), d.ok ? "已发布" : (d.error || "失败"), !!d.ok);
  if (d.ok) $("#nText").value = "";
  loadNotices();
});

async function loadNotices() {
  const d = await get("/admin/notices");
  $("#noticeBody").innerHTML = (d.items || []).map(n => `<tr>
    <td>${esc(n.text)}</td>
    <td>${n.active ? '<span class="pill ok">启用</span>' : '<span class="pill">停用</span>'}</td>
    <td class="sub">${fmt(n.start_at)} → ${fmt(n.end_at)}</td>
    <td><button class="btn sm ghost" data-act="ntoggle" data-id="${n.id}" data-on="${n.active ? 1 : 0}">${n.active ? "停用" : "启用"}</button></td>
  </tr>`).join("") || '<tr><td colspan="4" class="sub">暂无公告</td></tr>';
}

/* 密码 */
$("#doPwd").addEventListener("click", async () => {
  const d = await post("/password", { old: $("#pOld").value, next: $("#pNew").value });
  msg($("#pmsg"), d.ok ? "密码已更新" : (d.error || "失败"), !!d.ok);
});

/* 退出 */
$("#logout").addEventListener("click", async () => {
  await fetch(API + "/logout", { method: "POST", credentials: "same-origin" });
  location.reload();
});
