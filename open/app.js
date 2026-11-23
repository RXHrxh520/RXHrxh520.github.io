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
  document.getElementById('opts').hidden = true;
  document.getElementById('pwdForm').hidden = false;
  document.getElementById('u').focus({ preventScroll: true });
});

document.getElementById('pwdForm').addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('u').value.trim();
  const p = document.getElementById('p').value.trim();
  if (!u || !p) return toast('账号和密码不能为空');
  toast('账号服务尚未接入，可先使用匿名体验');
});

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
      'error-callback': () => { tsToken = ''; vgo.disabled = true; toast('人机验证加载失败，请刷新重试'); },
      'expired-callback': () => { tsToken = ''; vgo.disabled = true; toast('验证已过期，请重新验证'); },
    });
  } catch {
    toast('人机验证组件未加载，请检查网络后重试');
  }
}

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
    sessionStorage.setItem('rxh_open_preview', '1');
    setMode('preview');
    toast('验证通过 · 60 分钟只读预览');
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
if (sessionStorage.getItem('rxh_open_preview') === '1') app.dataset.mode = 'preview';
