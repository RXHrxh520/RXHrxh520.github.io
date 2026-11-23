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
  mountLoginTs();
  document.getElementById('opts').hidden = true;
  document.getElementById('pwdForm').hidden = false;
  document.getElementById('u').focus({ preventScroll: true });
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

function markLoggedIn(user) {
  const tag = document.getElementById('pvTag');
  const desc = document.getElementById('pvDesc');
  if (tag) tag.textContent = '已登录 · ' + user.name;
  if (desc) desc.textContent = '账号 ' + user.uid + ' · 统一账号服务已接入。';
  document.querySelectorAll('.row .st').forEach(el => {
    if (el.textContent === '已锁定') el.textContent = '已开放';
  });
}

document.getElementById('pwdForm').addEventListener('submit', async e => {
  e.preventDefault();
  const u = document.getElementById('u').value.trim();
  const p = document.getElementById('p').value.trim();
  if (!u || !p) return toast('账号和密码不能为空');
  if (!loginToken) return toast('请先完成人机验证');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = '登录中…';
  try {
    const res = await fetch('https://auth.rxh.asia/api/login', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: u, password: p, turnstile: loginToken }),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || '登录失败');
    if (d.sid) localStorage.setItem('rxh_sid', d.sid);
    sessionStorage.setItem('rxh_open_user', JSON.stringify(d.user));
    markLoggedIn(d.user);
    setMode('preview');
    toast('已登录 · ' + d.user.name);
  } catch (err) {
    toast(err.message || '登录失败');
    if (window.turnstile && loginWidget !== null) window.turnstile.reset(loginWidget);
    loginToken = '';
  } finally {
    btn.disabled = false; btn.textContent = '登录';
  }
});

/* 已登录则直接恢复 */
(function restore() {
  const saved = sessionStorage.getItem('rxh_open_user');
  if (saved) {
    try { markLoggedIn(JSON.parse(saved)); setMode('preview'); } catch (e) {}
    return;
  }
  const sid = localStorage.getItem('rxh_sid');
  if (!sid) return;
  fetch('https://auth.rxh.asia/api/me', { headers: { authorization: 'Bearer ' + sid } })
    .then(r => r.json()).then(d => {
      if (d.user) { sessionStorage.setItem('rxh_open_user', JSON.stringify(d.user)); markLoggedIn(d.user); setMode('preview'); }
      else localStorage.removeItem('rxh_sid');
    }).catch(() => {});
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


/* ---------- 公告条 ---------- */
(function(){
  fetch('https://auth.rxh.asia/api/notice',{cache:'no-store'}).then(r=>r.json()).then(d=>{
    const items=(d.items||[]).map(i=>i.text).filter(Boolean);
    if(!items.length) return;
    const bar=document.createElement('div');
    bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:80;display:flex;align-items:center;gap:26px;'+
      'padding:9px 16px;font-size:12.5px;color:#7a4b00;background:linear-gradient(90deg,#fff4dd,#ffe9c4);'+
      'border-bottom:1px solid #ffe0ad;overflow-x:auto;white-space:nowrap';
    bar.innerHTML=items.map(t=>'<span>'+String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</span>').join('');
    document.body.appendChild(bar);
    document.body.style.paddingTop='42px';
  }).catch(()=>{});
})();
