/* 接口基址：同域时走相对路径，被反代到 status.rxh.asia 时无需跨域 */
const SAME = location.hostname === 'status.rxh.asia';
const API = SAME ? '' : 'https://status.rxh.asia';

const $ = s => document.querySelector(s);
const SVC_NAME = { 'GitHub Pages 源站': '站点源站', 'GitHub Pages': '站点源站' };
const svcName = n => SVC_NAME[n] || String(n || '').replace(/GitHub Pages?/gi, '源站').trim();
let timer = null, tick = 300;

const ST = { operational:['正常','ok'], degraded:['降级','warn'], outage:['中断','bad'], unknown:['无数据','empty'] };
const OVERALL = {
  operational: ['所有系统运行正常','全部组件响应正常'],
  degraded: ['部分系统降级','存在响应偏慢或返回异常的服务'],
  outage: ['系统服务中断','有组件连续探测失败'],
  unknown: ['状态未知','暂无探测数据']
};

function errLabel(e){
  const m = {
    timeout: '请求超时（6s 无响应）',
    tls_error: 'TLS 握手失败',
    dns_error: 'DNS 解析失败',
    connect_failed: '连接被拒绝或无法建立',
    connection_reset: '连接被对端重置',
    fetch_failed: '请求失败'
  };
  if (String(e).startsWith('http_')) return 'HTTP ' + String(e).slice(5) + ' 响应';
  return m[e] || e || '未知故障';
}

function bars(days){
  return (days||[]).slice(-90).map(v=>{
    if(v===null||v===undefined) return '<i></i>';
    const c = v>=0.995?'ok':(v>=0.9?'warn':'bad');
    return `<i class="${c}"></i>`;
  }).join('');
}

function recent(list){
  return (list||[]).slice().reverse().map(x=>{
    const c = !x.ok ? 'bad' : (x.ms>1200 ? 'slow' : '');
    return `<i class="${c}" title="${new Date(x.at).toLocaleTimeString('zh-CN',{hour12:false})} · ${x.ok?x.ms+'ms':(x.error||'失败')}"></i>`;
  }).join('');
}

function row(s){
  const [txt, cls] = ST[s.status] || ST.unknown;
  const up = s.uptime_90d===null||s.uptime_90d===undefined ? '—' : (s.uptime_90d*100).toFixed(1).replace('.0','')+'%';
  const ping = s.latency_ms ? `${s.latency_ms} ms` : '—';
  const code = s.http_code ? `HTTP ${s.http_code}` : '无响应';
  return `<div class="comp">
    <div class="comp-top">
      <span class="nm">${svcName(s.name)}</span>
      <span class="url">${s.url.replace(/^https?:\/\//,'')}</span>
      <span class="ping">Ping <b>${ping}</b> · ${code}</span>
      <span class="st ${cls}">${txt}</span>
    </div>
    <div class="meta-row">
      <span>90 天可用率 ${up}</span>
      <span>90 天平均延迟 ${s.avg_ms_90d ? s.avg_ms_90d+' ms' : '—'}</span>
      <span>最近探测 ${s.checked_at ? new Date(s.checked_at).toLocaleTimeString('zh-CN',{hour12:false}) : '—'}</span>
    </div>
    ${s.error ? `<div class="err">故障原因：${errLabel(s.error)}</div>` : ''}
    <div class="bars">${bars(s.days)}</div>
    <div class="bars-scale"><span>90 天前</span><span>今天</span></div>
    <div class="recent">${recent(s.recent)}</div>
  </div>`;
}

function render(d){
  const [title, sub] = OVERALL[d.overall] || OVERALL.degraded;
  const bicon = $('#bicon');
  bicon.className = 'bicon' + (d.overall==='outage'?' bad':d.overall==='degraded'?' warn':'');
  bicon.innerHTML = d.overall==='operational'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12.5l5 5 11-11"/></svg>'
    : d.overall==='degraded'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 7v8M12 19h.01"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6l-12 12"/></svg>';
  $('#bTitle').textContent = title;
  $('#bSub').textContent = sub;
  $('#rows').innerHTML = (d.services||[]).map(row).join('');

  const inc = d.incidents||[];
  $('#incBody').innerHTML = inc.length
    ? inc.map(i=>`<div class="inc-item"><b>${i.service} 探测失败</b>
        <i>${new Date(i.at).toLocaleString('zh-CN')} · ${i.code?'HTTP '+i.code:'无响应'} · ${errLabel(i.error)}</i></div>`).join('')
    : '<div class="inc-body">暂无故障记录。</div>';
  $('#incCount').textContent = `最近 ${inc.length} 条`;

  $('#lastTime').textContent = new Date(d.generated_at).toLocaleTimeString('zh-CN',{hour12:false});
}

function fail(msg){
  const bicon = $('#bicon');
  bicon.className = 'bicon bad';
  bicon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6l-12 12"/></svg>';
  $('#bTitle').textContent = '状态数据获取失败';
  $('#bSub').textContent = msg || '边缘节点无响应，稍后自动重试';
}

async function load(probe){
  $('#runBtn').disabled = true;
  try{
    const res = await fetch(API + '/api/status' + (probe?'?probe=1':''), {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    render(await res.json());
  }catch(e){
    fail(e.message);
  }finally{
    $('#runBtn').disabled = false;
    tick = 300;
  }
}

function loop(){
  clearInterval(timer); tick = 300;
  timer = setInterval(()=>{
    tick--;
    const m = Math.floor(tick/60), sec = String(tick%60).padStart(2,'0');
    $('#nextTime').textContent = `${m}:${sec}`;
    if(tick<=0) load(false);
  }, 1000);
}

$('#runBtn').addEventListener('click', ()=>load(true));

function applyTheme(){
  const dark = localStorage.getItem('rxh_theme') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  $('#themeBtn').textContent = dark ? '白亮' : '暗夜';
}
$('#themeBtn').addEventListener('click', ()=>{
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  $('#themeBtn').textContent = dark ? '白亮' : '暗夜';
  localStorage.setItem('rxh_theme', dark ? 'dark' : 'light');
});

applyTheme();
load(false);
loop();

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
