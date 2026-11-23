/* 管理后台 */

const $ = s => document.querySelector(s);
const API = "/api";
let tsToken = "", tsWidget = null;

function msg(el, t, ok) { el.textContent = t || ""; el.className = "msg" + (t ? (ok ? " ok" : " err") : ""); }
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = t => { if (!t) return "—"; try { return new Date(t).toLocaleString("zh-CN", { hour12: false }); } catch { return t; } };
const toISO = v => v ? new Date(v).toISOString() : "";

/* 管理端登录仅校验账号密码与来源地区 */

/* 登录 */
$("#aLogin").addEventListener("click", async () => {
  const btn = $("#aLogin");
  btn.disabled = true; btn.textContent = "登录中…";
  try {
    const r = await fetch(API + "/login", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: $("#a").value.trim(), password: $("#b").value }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "登录失败");
    if (!d.user.is_admin) {
      await fetch(API + "/logout", { method: "POST", credentials: "same-origin" });
      throw new Error("该账号不是管理员");
    }
    enter(d.user);
  } catch (e) { msg($("#lmsg"), e.message); }
  finally { btn.textContent = "登录"; }
});

function enter(u) {
  $("#loginCard").classList.add("hide");
  $("#console").classList.remove("hide");
  $("#who").textContent = u.name;
  $("#whoUid").textContent = u.uid;
  loadAll();
}

/* 已有会话直接恢复 */
(async () => {
  try {
    const r = await fetch(API + "/me", { credentials: "same-origin", cache: "no-store" });
    const d = await r.json();
    if (d.user && d.user.is_admin) enter(d.user);
  } catch (e) { }
})();

/* 标签 */
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
  ["users", "invites", "notice", "notify", "appeals", "self"].forEach(p => $("#p-" + p).classList.toggle("hide", p !== t.dataset.p));
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
  loadUsers(); loadInvites(); loadNotices(); loadNotify(); loadAppeals();
}

async function loadAppeals() {
  const d = await get("/admin/appeals");
  const box = $("#appealList");
  const items = d.items || [];
  if (!items.length) { box.innerHTML = '<p class="sub">暂无申诉。</p>'; return; }
  box.innerHTML = items.map(a => `<div class="ap">
    <div class="ap-h"><b>${esc(a.email)}</b><span class="pill">${esc(a.uid || "未填 ID")}</span></div>
    <div class="ap-b">${esc(a.reason)}</div>
    <div class="ap-f"><span class="sub">${fmt(a.created_at)}</span><button class="btn sm ghost" data-ap="${a.id}">清除</button></div>
  </div>`).join("");
  box.querySelectorAll("[data-ap]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("确认清除这条申诉？")) return;
    await post("/admin/appeal/delete", { id: Number(b.dataset.ap) });
    loadAppeals();
  }));
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
          <button class="btn sm ghost" data-uid="${esc(u.uid)}" data-act="unban">解封</button>
          <button class="btn sm ghost" data-uid="${esc(u.uid)}" data-name="${esc(u.name)}" data-act="edit">改资料/ID</button>
          <button class="btn sm ghost danger" data-uid="${esc(u.uid)}" data-act="deluser">删除账号</button>
          <button class="btn sm ghost danger" data-uid="${esc(u.uid)}" data-act="deluser">删除账号</button></td>
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
  if (b.dataset.act === "edit") {
    const newUid = prompt("新的用户 ID（留空则不修改）\n示例：R-020260003810（0 普通 / 1 管理员 + 年份 + 当日序号 + 性别 + 校验位）", uid) || "";
    const newName = prompt("新的昵称（留空则不修改）", b.dataset.name || "") || "";
    if (!newUid.trim() && !newName.trim()) return;
    const d = await post("/admin/user/update", { uid, newUid: newUid.trim(), name: newName.trim() });
    msg($("#bmsg"), d.ok ? "已更新" : (d.error || "失败"), !!d.ok);
    loadUsers();
    return;
  }
  if (b.dataset.act === "deluser") {
    if (!confirm("确定删除该账号？账号、会话与密钥都会被清除，且不可恢复。")) return;
    const d = await post("/admin/user/delete", { uid });
    msg($("#bmsg"), d.ok ? "账号已删除" : (d.error || "失败"), !!d.ok);
    loadUsers();
    return;
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

/* 站内通知 */
const NT = {1:"系统公告",2:"管理员公告",3:"系统通知",4:"安全通知",5:"测试通知"};
const NTI = {
  1:'<path d="M4 10v4h3l6 4V6l-6 4H4Z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  2:'<path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M5 11v5l7 4 7-4v-5"/>',
  3:'<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>',
  4:'<path d="M12 3l7 3v6c0 4-3 7-7 9-7-2-7-5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
  5:'<path d="M9 3h6M10 3v6L5 19h14L14 9V3"/><path d="M7.5 14h9"/>',
};
let ntType = 3;
document.querySelectorAll(".ntype").forEach(b => {
  if (!b.querySelector("svg")) b.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${NTI[Number(b.dataset.t)] || NTI[3]}</svg>`);
});
document.querySelectorAll(".ntype").forEach(b => b.addEventListener("click", () => {
  ntType = Number(b.dataset.t);
  document.querySelectorAll(".ntype").forEach(x => x.classList.toggle("on", x === b));
}));
function ntIcon(t){ return `<span class="nt-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${NTI[t]||NTI[3]}</svg></span>`; }
$("#doNotify").addEventListener("click", async () => {
  const body = { type: ntType, title: $("#ntTitle").value.trim(), body: $("#ntBody").value.trim() };
  if (!body.title) return msg($("#ntmsg"), "通知标题不能为空");
  const d = await post("/admin/notification", body);
  msg($("#ntmsg"), d.ok ? "已发布" : (d.error || "失败"), !!d.ok);
  if (d.ok) { $("#ntTitle").value = ""; $("#ntBody").value = ""; }
  loadNotify();
});

async function loadNotify() {
  const d = await get("/admin/notifications");
  const list = d.items || [];
  $("#ntBodyList").innerHTML = list.map(n => `<tr>
    <td>${ntIcon(n.type)}<span class="pill">${NT[n.type] || n.type}</span></td>
    <td><b>${esc(n.title)}</b><br><span class="sub">${esc(n.body || "")}</span></td>
    <td>${n.active ? '<span class="pill ok">显示中</span>' : '<span class="pill">已隐藏</span>'}</td>
    <td class="sub">${fmt(n.created_at)}</td>
    <td><button class="btn sm ghost" data-act="ntg" data-id="${n.id}" data-on="${n.active ? 1 : 0}">${n.active ? "隐藏" : "显示"}</button>
        <button class="btn sm ghost" data-act="ntdel" data-id="${n.id}">删除</button></td>
  </tr>`).join("") || '<tr><td colspan="5" class="sub">暂无通知</td></tr>';
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act='ntg'],[data-act='ntdel']");
  if (!b) return;
  const d = b.dataset.act === "ntg"
    ? await post("/admin/notification/toggle", { id: Number(b.dataset.id), active: b.dataset.on === "1" ? 0 : 1 })
    : await post("/admin/notification/delete", { id: Number(b.dataset.id) });
  msg($("#ntmsg"), d.ok ? "已更新" : (d.error || "失败"), !!d.ok);
  loadNotify();
});

/* 密码 */
$("#doPwd").addEventListener("click", async () => {
  const d = await post("/admin/password", { old: $("#pOld").value, next: $("#pNew").value });
  msg($("#pmsg"), d.ok ? "密码已更新" : (d.error || "失败"), !!d.ok);
});

/* 退出 */
$("#logout").addEventListener("click", async () => {
  await fetch(API + "/logout", { method: "POST", credentials: "same-origin" });
  location.reload();
});
