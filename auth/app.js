/* RXH 账号中心：登录 / 注册 共用一个人机验证组件 */

const API = "/api";
const $ = s => document.querySelector(s);
let tsToken = "";
let tsWidget = null;

/* ---------- 提示 ---------- */
function say(el, text, ok) {
  el.textContent = text || "";
  el.className = "msg" + (text ? (ok ? " ok" : " err") : "");
}

/* ---------- Turnstile（整页共用） ---------- */
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
function syncBtns() {
  const ok = !!tsToken && $("#agree").checked;
  $("#loginBtn").disabled = !ok;
  $("#regBtn").disabled = !ok;
}
(async () => {
  try {
    const ts = await whenTs();
    tsWidget = ts.render("#tsBox", {
      sitekey: window.TURNSTILE_SITEKEY,
      theme: "auto",
      callback: t => { tsToken = t; syncBtns(); },
      "expired-callback": () => { tsToken = ""; syncBtns(); },
      "error-callback": () => { tsToken = ""; syncBtns(); },
    });
  } catch {
    say($("#loginMsg"), "人机验证组件加载失败，请刷新重试");
  }
})();
$("#agree").addEventListener("change", syncBtns);
function resetTs() {
  if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget);
  tsToken = "";
  syncBtns();
}

/* 支持 ?tab=reg 直接打开注册 */
if(new URLSearchParams(location.search).get("tab")==="reg"){
  document.querySelector('.tab[data-tab="reg"]').click();
}

/* ---------- 切换 ---------- */
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
    const isLogin = t.dataset.tab === "login";
    $("#loginForm").hidden = !isLogin;
    $("#regForm").hidden = isLogin;
    say($("#loginMsg"), ""); say($("#regMsg"), "");
  });
});

/* ---------- 登录 ---------- */
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#loginBtn");
  const msg = $("#loginMsg");
  if (!$("#agree").checked) return say(msg, "请先勾选并同意用户协议与隐私政策");
  btn.disabled = true;
  btn.textContent = "登录中…";
  try {
    const r = await fetch(API + "/login", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: $("#la").value.trim(), password: $("#lp").value, turnstile: tsToken }),
    });
    const d = await r.json();
    if (r.status === 403 && d.banned) {
      $("#banLine").textContent = `原因：${d.ban.reason || "未填写"}　时间：${fmt(d.ban.start_at)} → ${fmt(d.ban.end_at)}`;
      $("#banModal").classList.add("on");
      say(msg, "账号处于封禁期，登录态已清除", false);
      return;
    }
    if (!d.ok) throw new Error(d.error || "登录失败");
    say(msg, "登录成功，正在跳转…", true);
    const next = new URLSearchParams(location.search).get("next");
    location.href = next && next.startsWith("/") ? next : "/account/";
  } catch (err) {
    say(msg, err.message || "登录失败");
  } finally {
    btn.textContent = "登录";
    resetTs();
  }
});

/* ---------- 注册 ---------- */
$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#regBtn");
  const msg = $("#regMsg");
  if (!$("#agree").checked) return say(msg, "请先勾选并同意用户协议与隐私政策");
  btn.disabled = true;
  btn.textContent = "提交中…";
  try {
    const r = await fetch(API + "/register", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: $("#re").value.trim(), name: $("#rn").value.trim(),
        password: $("#rp").value, invite: $("#ri").value.trim(),
        gender: Number($("#rg").value || 0), turnstile: tsToken,
      }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "注册失败");
    if (d.sid) localStorage.setItem("rxh_sid", d.sid);
    say(msg, `注册成功，你的 ID 是 ${d.uid}`, true);
    setTimeout(() => location.href = "/account/", 800);
  } catch (err) {
    say(msg, err.message || "注册失败");
  } finally {
    btn.textContent = "注册";
    resetTs();
  }
});

/* ---------- 协议 ---------- */
const DOCS = {
  terms: `
    <h2>RXH 用户协议</h2>
    <p>更新日期：2026-11-24　生效日期：2026-11-24</p>
    <p>本协议由 {运营主体名称}（注册地址：{注册地址}，联系邮箱：{联系邮箱}，联系电话：{联系电话}）与您共同订立。</p>
    <h3>一、账号与注册</h3>
    <p>本平台采取邀请制注册。您须使用管理员发放的邀请码完成注册，并对提交的邮箱、昵称等信息真实性负责。一个邀请码的使用次数以发放时标注为准。</p>
    <h3>二、账号标识</h3>
    <p>系统为您分配的 ID（格式为 RXH-XXXXXX）是唯一标识，注册后不可自行修改；昵称可按规则修改，但不得包含违法、侵权或冒充他人的内容。</p>
    <h3>三、使用规范</h3>
    <ul>
      <li>不得利用本平台从事违反法律法规的活动；</li>
      <li>不得对平台发起自动化攻击、爬取、压测或绕过安全验证；</li>
      <li>不得共享、转售账号或以任何方式规避封禁措施。</li>
    </ul>
    <h3>四、封禁与终止</h3>
    <p>若账号存在违规行为，管理员可设定封禁开始时间、结束时间与理由。封禁期间您的全部登录态将被清除，且无法通过原凭据访问平台任一服务。</p>
    <h3>五、服务变更</h3>
    <p>平台可能调整、暂停或下线部分功能，重要变更会通过站内公告告知。</p>
    <h3>六、免责</h3>
    <p>因不可抗力、网络故障、第三方服务中断导致的服务不可用，本平台在合理范围内不承担责任。</p>
    <h3>七、联系方式</h3>
    <p>邮箱：{联系邮箱}　电话：{联系电话}　地址：{注册地址}</p>
  `,
  privacy: `
    <h2>RXH 隐私政策</h2>
    <p>更新日期：2026-11-24</p>
    <p>本政策说明我们如何收集、使用、存储与保护您的个人信息。运营主体：{运营主体名称}，地址：{注册地址}，联系方式：{联系电话} / {联系邮箱}。</p>
    <h3>一、我们收集的信息</h3>
    <ul>
      <li>账号信息：邮箱、昵称、头像链接、系统分配的 ID；</li>
      <li>安全信息：登录时间、IP 地址、浏览器标识（用于会话与风控）；</li>
      <li>人机验证结果：由 Cloudflare Turnstile 生成的一次性凭证，不含您的生物特征。</li>
    </ul>
    <h3>二、使用目的</h3>
    <p>用于身份识别、登录保持、防刷与封禁执行、账号找回与安全审计，不用于广告投放。</p>
    <h3>三、存储与期限</h3>
    <p>账号数据存储于 {数据存储地区} 的云数据库；会话记录保留 7 天，封禁记录保留至封禁结束后 90 天。</p>
    <h3>四、共享与披露</h3>
    <p>除法律法规要求或您另行授权外，我们不会向第三方提供您的个人信息。人机验证由 Cloudflare 提供，其处理规则适用其隐私政策。</p>
    <h3>五、您的权利</h3>
    <p>您可在个人中心查看与修改昵称、头像；可申请导出或删除账号数据，请联系 {联系邮箱}。</p>
    <h3>六、Cookie</h3>
    <p>我们使用必要 Cookie 维持登录态与安全校验，不使用第三方广告 Cookie。</p>
    <h3>七、未成年人</h3>
    <p>未满 14 周岁的用户应在监护人陪同下使用，并由监护人代为同意本政策。</p>
  `,
};

document.querySelectorAll("[data-doc]").forEach(a => {
  a.addEventListener("click", () => {
    $("#docBody").innerHTML = DOCS[a.dataset.doc] || "";
    $("#docModal").classList.add("on");
  });
});
$("#docX").addEventListener("click", () => $("#docModal").classList.remove("on"));
$("#docModal").addEventListener("click", e => { if (e.target.id === "docModal") $("#docModal").classList.remove("on"); });
$("#banX").addEventListener("click", () => $("#banModal").classList.remove("on"));

function fmt(t) {
  if (!t) return "—";
  try { return new Date(t).toLocaleString("zh-CN", { hour12: false }); } catch { return t; }
}

/* ---------- 公告 ---------- */
fetch(API + "/notice").then(r => r.json()).then(d => {
  const bar = $("#noticeBar");
  const items = (d.items || []).map(i => i.text);
  if (!items.length) return;
  bar.textContent = items.join("　｜　");
  bar.classList.add("on");
}).catch(() => {});
