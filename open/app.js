/* RXH 开放平台 · 登录与匿名体验
 * 匿名入口必须过 Cloudflare Turnstile（服务端校验），通过后进入只读预览。 */

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const SITEKEY = window.TURNSTILE_SITEKEY || '';
const GATE = '/api/verify';

let toastTimer;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2400);
}

function setMode(mode) {
  if (app.dataset.mode === mode) return;
  const apply = () => { app.dataset.mode = mode; window.scrollTo(0, 0); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

/* ---------- 入口 ---------- */
document.getElementById('start').addEventListener('click', () => setMode('auth'));
document.getElementById('start2')?.addEventListener('click', () => setMode('auth'));
document.getElementById('close').addEventListener('click', () => setMode('intro'));
document.getElementById('vclose').addEventListener('click', () => setMode('auth'));
document.getElementById('back').addEventListener('click', () => {
  document.getElementById('pwdForm').hidden = true;
  document.getElementById('opts').hidden = false;
});

document.getElementById('optPwd').addEventListener('click', doLogin);

/* ---------- 统一账号登录（auth.rxh.asia） ---------- */
let loginWidget = null, loginToken = '';
function mountLoginTs() {
  if (loginWidget !== null || !window.turnstile) return;
  loginWidget = window.turnstile.render('#tsLogin', {
    sitekey: SITEKEY,
    callback: t => { loginToken = t; },
    'expired-callback': () => { loginToken = ''; },
  });
}

let currentUser = null;
function enterConsole(user) {
  currentUser = user || null;
  sessionStorage.setItem('rxh_open_user', JSON.stringify(user || {}));
  const tag = document.getElementById('pvTag');
  const desc = document.getElementById('pvDesc');
  const side = document.getElementById('sideUser');
  const li = document.getElementById('loginInline');
  if (tag) { tag.textContent = user.is_admin ? '管理员' : '已登录'; tag.dataset.on = '1'; }
  if (desc) desc.textContent = '账号 ' + user.uid + (user.is_admin ? ' · 管理员' : '') + ' · 可与主站、账号中心通用。';
  if (side) side.textContent = (user.name || '未命名') + ' · 正式账号';
  if (li) li.hidden = true;
  setMode('preview');
  loadKeys();
}
function guestConsole() {
  currentUser = null;
  sessionStorage.setItem('rxh_open_preview', '1');
  document.getElementById('pvTag').textContent = '匿名预览';
  document.getElementById('sideUser').textContent = '访客 · 只读';
  document.getElementById('pvDesc').textContent = '当前为只读预览：可浏览模型与文档，创建密钥需要登录。';
  document.getElementById('loginInline').hidden = false;
  document.getElementById('keyList').innerHTML = '<div class="empty">登录后可创建与查看密钥</div>';
  document.getElementById('statKeys').textContent = '0';
  setMode('preview');
}
function guestConsole() {
  sessionStorage.setItem('rxh_open_preview', '1');
  document.getElementById('pvTag').textContent = '匿名预览';
  document.getElementById('sideUser').textContent = '访客 · 只读';
  setMode('preview');
}

/* 已登录则直接复用统一账号会话 */
(async () => {
  const saved = sessionStorage.getItem('rxh_open_user');
  if (saved) { try { enterConsole(JSON.parse(saved)); return; } catch (e) {} }
  if (sessionStorage.getItem('rxh_open_preview') === '1') { guestConsole(); return; }
  try {
    const r = await fetch('https://auth.rxh.asia/api/me', { credentials: 'include', cache: 'no-store' });
    const d = await r.json();
    if (d.user) return enterConsole(d.user);
  } catch (e) { }
  if (!window.RXHAuth) return;
  const u = await window.RXHAuth.check();
  if (u && !u.banned) enterConsole(u);
})();

/* ---------- Turnstile ---------- */
let tsWidget = null;
let tsToken = '';
const vgo = document.getElementById('vgo');

function whenTurnstile(timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const t0 = Date.now();
    const tick = () => {
      if (window.turnstile) return resolve(window.turnstile);
      if (Date.now() - t0 > timeout) return reject(new Error('turnstile-timeout'));
      setTimeout(tick, 120);
    };
    tick();
  });
}

async function mountTurnstile() {
  const box = document.getElementById('tsbox');
  try {
    const ts = await whenTurnstile();
    if (tsWidget !== null) { ts.reset(tsWidget); tsToken = ''; vgo.disabled = true; return; }
    tsWidget = ts.render(box, {
      sitekey: SITEKEY,
      theme: 'auto',
      size: 'normal',
      callback: token => { tsToken = token; vgo.disabled = false; },
      'error-callback': () => {
        tsToken = '';
        vgo.disabled = true;
        document.getElementById('tsretry').hidden = false;
        toast('验证未通过，可点「重新验证」再来一次');
      },
      'expired-callback': () => { tsToken = ''; vgo.disabled = true; toast('验证已过期，请重新验证'); },
    });
  } catch {
    toast('人机验证组件未加载，请检查网络后重试');
  }
}

document.getElementById('tsretry').addEventListener('click', () => {
  document.getElementById('tsretry').hidden = true;
  if (window.turnstile && tsWidget !== null) {
    window.turnstile.reset(tsWidget);
    tsToken = '';
    vgo.disabled = true;
  } else {
    mountTurnstile();
  }
});

/* 点匿名体验 → 进验证页 → 渲染控件 */
document.getElementById('optGuest').addEventListener('click', () => {
  setMode('verify');
  mountTurnstile();
});

vgo.addEventListener('click', async () => {
  if (!tsToken) return toast('请先完成人机验证');
  vgo.disabled = true;
  const label = vgo.textContent;
  vgo.textContent = '验证中…';
  try {
    const res = await fetch(GATE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ token: tsToken }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'verify-failed');
    guestConsole();
    toast('验证通过 · 30 分钟只读预览');
  } catch (e) {
    toast('验证未通过，请重试');
    if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget);
    tsToken = '';
  } finally {
    vgo.textContent = label;
    vgo.disabled = !tsToken;
  }
});

/* ---------- 控制台导航 ---------- */
const CRUMB = { overview: '概览', models: '模型广场', keys: 'API 密钥', usage: '用量', docs: '接入文档' };
document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.panel;
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('on', x === b));
  Object.keys(CRUMB).forEach(p => { const el = document.getElementById('pn-' + p); if (el) el.hidden = p !== k; });
  document.getElementById('crumb').textContent = '控制台 / ' + CRUMB[k];
}));

document.getElementById('loginInline').addEventListener('click', doLogin);
function doLogin() {
  if (!window.RXHAuth) return toast('账号组件未加载，请刷新重试');
  window.RXHAuth.open({ onSuccess: u => { enterConsole(u); toast('已登录 · ' + (u.name || u.uid)); } });
}

/* ---------- 密钥 ---------- */
async function loadKeys() {
  const list = document.getElementById('keyList');
  const msgEl = document.getElementById('keyMsg');
  if (!currentUser) { list.innerHTML = '<div class="empty">登录后可创建与查看密钥</div>'; return; }
  let keys = [];
  try {
    const r = await fetch('https://auth.rxh.asia/api/keys', { credentials: 'include', cache: 'no-store' });
    const d = await r.json();
    keys = (d.keys || d.items || []).filter(k => !k.revoked);
  } catch (e) { list.innerHTML = '<div class="empty">读取密钥失败</div>'; return; }
  document.getElementById('statKeys').textContent = String(keys.length);
  if (!keys.length) { list.innerHTML = '<div class="empty">暂无密钥，填写备注后创建</div>'; return; }
  list.innerHTML = keys.map(k => `<div class="keyrow" data-id="${k.id}">
    <b>${esc(k.prefix)}…</b>
    <span class="meta">${esc(k.name || '未命名')} · ${fmt(k.created_at)}${k.last_used ? ' · 最近使用 ' + fmt(k.last_used) : ''}</span>
    <button title="吊销" data-revoke="${k.id}"><svg viewBox="0 0 24 24"><use href="#i-trash"/></svg></button>
  </div>`).join('');
  list.querySelectorAll('[data-revoke]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('吊销后该密钥立即失效，确定？')) return;
    const r = await fetch('https://auth.rxh.asia/api/keys/delete', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: Number(btn.dataset.revoke) }) });
    const d = await r.json();
    msgEl.textContent = d.ok ? '密钥已吊销' : (d.error || '操作失败');
    loadKeys();
  }));
}

document.getElementById('createKey').addEventListener('click', async () => {
  const msgEl = document.getElementById('keyMsg');
  if (!currentUser) { msgEl.textContent = '请先登录账号'; return; }
  const name = document.getElementById('keyName').value.trim() || 'default';
  const btn = document.getElementById('createKey');
  btn.disabled = true;
  try {
    const r = await fetch('https://auth.rxh.asia/api/keys', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json();
    if (!d.ok) { msgEl.textContent = d.error || '创建失败'; return; }
    document.getElementById('keyName').value = '';
    msgEl.innerHTML = '新密钥（仅显示一次）：<b class="mono">' + esc(d.key) + '</b>，请立即复制保存。';
    loadKeys();
  } catch (e) { msgEl.textContent = '创建失败，请重试'; }
  finally { btn.disabled = false; }
});

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmt(t) { if (!t) return '—'; try { return new Date(t).toLocaleDateString('zh-CN'); } catch { return t; } }

/* ---------- 预览 ---------- */
document.getElementById('exit').addEventListener('click', () => {
  sessionStorage.removeItem('rxh_open_preview');
  sessionStorage.removeItem('rxh_open_user');
  setMode('intro');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && app.dataset.mode !== 'intro') setMode('intro');
});

/* 同标签页刷新后仍停在预览 */



/* 公告条由共享脚本注入 */
