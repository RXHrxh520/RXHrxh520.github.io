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
document.getElementById('close').addEventListener('click', () => setMode('intro'));
document.getElementById('vclose').addEventListener('click', () => setMode('auth'));
document.getElementById('back').addEventListener('click', () => {
  document.getElementById('pwdForm').hidden = true;
  document.getElementById('opts').hidden = false;
});

document.getElementById('optPwd').addEventListener('click', () => {
  if (!window.RXHAuth) return toast('账号组件未加载，请刷新重试');
  window.RXHAuth.open({ onSuccess: user => { enterConsole(user); toast('已登录 · ' + user.name); } });
});

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

function enterConsole(user) {
  sessionStorage.setItem('rxh_open_user', JSON.stringify(user));
  const tag = document.getElementById('pvTag');
  const desc = document.getElementById('pvDesc');
  const side = document.getElementById('sideUser');
  if (tag) tag.textContent = '已登录';
  if (desc) desc.textContent = '账号 ' + user.uid + ' · 统一账号服务已接入，可在主站与账号中心通用。';
  if (side) side.textContent = user.name + ' · 正式账号';
  document.querySelectorAll('.nav-item.lock').forEach(el => el.classList.remove('lock'));
  document.querySelectorAll('[data-lock]').forEach(el => { el.disabled = false; el.classList.remove('mini'); });
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
  if (sessionStorage.getItem('rxh_open_preview') === '1') { setMode('preview'); return; }
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

/* ---------- 预览 ---------- */
document.getElementById('exit').addEventListener('click', () => {
  sessionStorage.removeItem('rxh_open_preview');
  setMode('intro');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && app.dataset.mode !== 'intro') setMode('intro');
});

/* 同标签页刷新后仍停在预览 */



/* 公告条由共享脚本注入 */
