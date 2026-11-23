/* RXH 开放平台 · 登录页逻辑
 * 纯前端：无注册入口；匿名登录写临时 cookie，仅预览。 */

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const GUEST = 'rxh_open_guest';

let toastTimer;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
}

function hasGuest() {
  return document.cookie.split('; ').some(c => c.startsWith(GUEST + '='));
}
function setGuest() {
  document.cookie = GUEST + '=1; Max-Age=3600; Path=/; SameSite=Lax';
}
function clearGuest() {
  document.cookie = GUEST + '=; Max-Age=0; Path=/; SameSite=Lax';
}

/* 状态切换：能用 View Transitions 就走原生过渡，否则退回 CSS 动画 */
function go(mode) {
  if (app.dataset.mode === mode) return;
  const apply = () => { app.dataset.mode = mode; window.scrollTo(0, 0); };
  if (mode === 'intro') {
    clearGuest();
    document.getElementById('pwdForm').hidden = true;
    document.getElementById('opts').hidden = false;
  }
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

document.getElementById('start').addEventListener('click', () => go('auth'));
document.getElementById('close').addEventListener('click', () => go('intro'));
document.getElementById('back').addEventListener('click', () => {
  document.getElementById('pwdForm').hidden = true;
  document.getElementById('opts').hidden = false;
});

document.getElementById('optPwd').addEventListener('click', () => {
  document.getElementById('opts').hidden = true;
  document.getElementById('pwdForm').hidden = false;
  document.getElementById('u').focus({ preventScroll: true });
});

document.getElementById('optGuest').addEventListener('click', () => {
  setGuest();
  go('preview');
  toast('已进入匿名预览 · 60 分钟');
});

document.getElementById('pwdForm').addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('u').value.trim();
  const p = document.getElementById('p').value.trim();
  if (!u || !p) return toast('账号和密码不能为空');
  toast('账号服务尚未接入，请使用匿名登录预览');
});

document.getElementById('exit').addEventListener('click', () => {
  clearGuest();
  go('intro');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && app.dataset.mode !== 'intro') go('intro');
});

/* 刷新后保留匿名预览 */
if (hasGuest()) app.dataset.mode = 'preview';
