import {mountDzhAux} from './dzh-aux.js';
import {mountDzhImport} from './dzh-data.js';
import {analyze,parseCSV,demoCSV} from './indicators.js';
import {mountPool} from './pool.js';
import {mountQuick} from './quick.js';
import {marketPanel,financePanel,backtestPanel,mountIntegrations} from './integrations.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let store={};try{store=JSON.parse(localStorage.getItem('zhiheng-v1')||'{}');if(!store||Array.isArray(store)||typeof store!=='object')store={}}catch{}
let step=0,groups=new Map(),results=[],source='',demo=false,sourceKind='csv',cleanup=()=>{};
const names=['确定约束','建立股票池','分析企业','判断价格','交易计划','定期复盘'];
function save(){try{localStorage.setItem('zhiheng-v1',JSON.stringify(store));$('#saved').textContent='已保存在本机浏览器'}catch{$('#saved').textContent='保存失败，请导出研究记录备份'}}
function field(key,title,value='',type='text'){return `<label>${title}<input data-key="${key}" type="${type}" value="${esc(store[key]??value)}"></label>`}
function area(key,title){return `<label>${title}<textarea data-key="${key}">${esc(store[key]||'')}</textarea></label>`}
function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function calc(){const capital=Number(store.capital??100000),risk=Number(store.risk??.5);if(!(capital>0&&risk>0&&risk<=5))throw Error('账户资金须大于零，单笔风险须大于 0 且不超过 5%');results=[...groups.values()].map(b=>analyze(b,capital,risk));}
function render(){
 cleanup();
 $('#steps').innerHTML=names.map((n,i)=>`<button data-step="${i}" class="${step===i?'active':''}">0${i+1}　${n}</button>`).join('');
 let html='';
 if(step===0)html=`<h2>先定义你的投资边界</h2><p>这些约束用于研究与风险测算；不会自动形成最优投资方案。</p><div class="grid">${field('capital','研究账户资金（元）',100000,'number')}${field('risk','单笔计划风险占资金（%，上限 5）',.5,'number')}${field('drawdown','可承受最大回撤（%）',15,'number')}${field('months','资金闲置期限（月）',24,'number')}${field('hours','每周研究时间（小时）',4,'number')}<label>研究周期<select data-key="horizon">${['中长期基本面研究','波段交易','趋势交易'].map(x=>`<option ${store.horizon===x?'selected':''}>${x}</option>`).join('')}</select></label></div>${area('boundaries','不参与的行业、资金用途及其他约束')}`;
 if(step===1){
 html=marketPanel()+`<h2>用可解释的条件，缩小研究范围</h2><p>导入日线 CSV，每只股票至少 20 条记录。请使用一致的复权口径、成交量单位和截止日期；不要混用不同数据源。</p><div class="actions"><label class="upload">导入行情 CSV<input id="file" type="file" accept=".csv" hidden></label><button id="demo">载入演示数据</button><button id="sample">下载格式样例</button><button id="export">导出筛选结果</button></div><div class="actions"><label>筛选条件<select id="filter"><option value="trend">收盘价 ＞ MA20</option><option value="volume">趋势成立且量比 ≥ 1.2</option><option value="all">查看全部</option></select></label></div><div id="error" class="error" role="alert"></div><div id="table"></div><p class="small">技术入围仅代表满足规则。停牌、ST、上市板块、退市风险和财务真实性尚未自动核验；未提供这些数据的股票不能视为已通过检查。</p>`;
 }
 if(step>=2&&step<=4){html=`<label>研究对象（代码＋名称；每只股票独立保存）<input id="subject" value="${esc(store.subject||'')}" placeholder="例如：600000 某公司"></label>`;const k='stock:'+ (store.subject||'未指定')+':';
 if(step===2)html+=financePanel()+`<h2>企业能否持续赚钱？</h2><div class="grid">${area(k+'business','商业模式与竞争优势')}${area(k+'finance','盈利、现金流与负债：填入报告期和来源')}${area(k+'governance','财务真实性、关联交易、质押、减持与再融资')}</div>${area(k+'thesis','投资逻辑、验证指标和需要排除的风险')}`;
 if(step===3)html+=`<h2>把价格拆成可以讨论的假设</h2><p>简化估值：预期每股收益 × 预期市盈率。亏损企业或周期高点盈利不适合机械使用此模型；以下是手动假设，不是目标价预测。</p><div class="grid">${['bear','base','bull'].map((x,i)=>`<div>${field(k+x+'eps',['悲观','基准','乐观'][i]+'：预期 EPS（元）','','number')}${field(k+x+'pe','预期市盈率（倍）','','number')}<strong id="${x}">待输入</strong></div>`).join('')}</div>${area(k+'valuation','假设依据、预测年份及估值失效条件')}`;
 if(step===4)html+=`<h2>买入之前，先写退出条件</h2><p>筛选页提供 2×ATR 风险距离参考。默认按 100 股取整，仅适用于相应申报规则的股票；科创板、北交所需另核对规则。未计佣金、滑点和涨跌停。</p><div class="grid">${area(k+'entry','买入触发条件和计划价格')}${area(k+'position','计划股数、金额与组合集中度')}${area(k+'exit','逻辑失效、价格退出及止盈条件')}</div>${area(k+'gaps','T+1、跳空或跌停卖不出时的应对')}`;
 }
 if(step===5)html=backtestPanel()+`<h2>让记录帮助你修正方法</h2><p>上方回测与下方实际交易复盘分别记录；尚未接入券商成交数据。</p>${area('journal','记录日期、股票、成交价、费用、买卖理由、结果和执行偏差')}${area('review','阶段复盘：收益来源、最大回撤、与基准比较、下一轮改进')}<button id="backup">导出全部研究记录 JSON</button>`;
 $('#screen').innerHTML=`<div class="panel">${html}<p id="saved" class="small" role="status"></p></div>`;
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{step=+b.dataset.step;render()});
 document.querySelectorAll('[data-key]').forEach(el=>el.oninput=()=>{store[el.dataset.key]=el.value;save();valuation()});
 if($('#subject'))$('#subject').onchange=e=>{store.subject=e.target.value.trim();save();render()};
 if(step===1){if(groups.size){try{calc()}catch(e){$('#error').textContent=e.message}}$('#demo').onclick=()=>load(demoCSV(),'内置合成数据',true);$('#sample').onclick=()=>download('demo-format.csv',demoCSV(),'text/csv');$('#file').onchange=async e=>{const f=e.target.files[0];if(f)load(await f.text(),f.name,false)};$('#filter').onchange=table;$('#export').onclick=()=>{if(!results.length)return alert('请先导入行情');download('screening.csv','data_source,data_kind,code,name,date,close,ma20,atr14_simple,volume_ratio,trend,reference_stop,reference_shares\n'+results.filter(filter).map(r=>[source,demo?'DEMO':sourceKind==='online'?'ONLINE_DAILY':'USER_IMPORT',r.code,r.name,r.date,r.close,r.ma20,r.atr,r.ratio??'',r.trend,r.stop,r.shares].map(csv).join(',')).join('\n'),'text/csv')};table();}
 cleanup=mountIntegrations({esc,store,download,getGroups:()=>groups,getDataInfo:()=>({demo,source,sourceKind}),getSubject:()=>store.subject||'',onHistory:acceptHistory});
 if($('#backup'))$('#backup').onclick=()=>download('research-notes.json',JSON.stringify({exportedAt:new Date().toISOString(),notes:store},null,2),'application/json');valuation();
}
function csv(x){let s=String(x);if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
function filter(r){return $('#filter').value==='all'||(r.trend&&($('#filter').value!=='volume'||r.ratio>=1.2))}
function table(){if(!results.length){$('#table').innerHTML='<p>还没有行情。可先载入演示数据体验筛选。</p>';return}const list=results.filter(filter),num=x=>x==null?'—':x.toFixed(2);$('#table').innerHTML=`<div class="cards"><div class="stat">已分析<strong>${results.length}</strong>只股票</div><div class="stat">规则入围<strong>${list.length}</strong>只股票</div><div class="stat">数据类型<strong>${demo?'演示':sourceKind==='online'?'联网日线':'用户导入'}</strong>最新报价见上方；日线不盘中刷新</div></div><div class="tablewrap"><table><thead><tr>${['股票','日期','收盘','MA20','量比¹','ATR14²','参考退出价','参考股数³'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${list.map(r=>`<tr><td><button data-code="${r.code}">${esc(r.code)} ${esc(r.name)}</button></td><td>${r.date}</td><td>${num(r.close)}</td><td>${num(r.ma20)}</td><td>${num(r.ratio)}</td><td>${num(r.atr)}</td><td>${r.stop>0?num(r.stop):'不适用'}</td><td>${r.shares}</td></tr>`).join('')}</tbody></table></div><p class="small">¹ 当日成交量 / 前 20 日平均成交量。² 最近 14 日真实波幅的简单均值，非 Wilder 平滑。³ 风险预算 ÷ (2×ATR)，按 100 股向下取整并限制不超过账户资金；不是建议买入数量。未计现有持仓。</p>`;document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{const r=results.find(x=>x.code===b.dataset.code);store.subject=r.code+' '+r.name;step=2;render()})}
function load(text,name,isDemo){try{const next=parseCSV(text);const old=groups;groups=next;try{calc()}catch(e){groups=old;throw e}source=name;demo=isDemo;sourceKind='csv';const dates=[...new Set(results.map(x=>x.date))];$('#source').textContent=`${demo?'演示模式：合成行情，不对应真实股票':'用户导入：'+source+'；来源和复权口径未核验'} · 截止日期 ${dates.join(' / ')}${dates.length>1?'；警告：截止日期不一致，不宜直接横向比较':''}`;$('#error').textContent='';table()}catch(e){$('#error').textContent=e.message}}
function acceptHistory(all){
 const next=new Map(all.map(x=>[x.code,x.bars])),old=groups;groups=next;try{calc()}catch(e){groups=old;throw e}
 source='腾讯财经公开日线（不复权）';demo=false;sourceKind='online';
 const dates=[...new Set(all.map(x=>x.last_date))];$('#source').textContent='联网日线 · '+source+' · 截止 '+dates.join(' / ')+' · 不含未完成日线；'+(dates.length>1?'截止日期不一致，请核查停牌和数据更新':'报价与日线时间分开显示');$('#error').textContent='';table();
}
function valuation(){if(step!==3)return;const k='stock:'+(store.subject||'未指定')+':';for(const x of ['bear','base','bull']){const a=Number(store[k+x+'eps']),b=Number(store[k+x+'pe']);$('#'+x).textContent=a>0&&b>0?'情景估值 '+(a*b).toFixed(2)+' 元':'输入正数 EPS 与市盈率'}}
render();

mountDzhAux({esc});
mountDzhImport();
mountQuick({esc,download,onHistory:data=>{groups=new Map([[data.code,data.bars]]);source=data.source;sourceKind='online';demo=false;store.subject=data.code+' '+data.name;try{calc()}catch{}render();document.querySelector('#source').textContent='一键分析载入的日线 · '+data.source+' · 截止 '+data.last_date;}});

mountPool({esc,download,onSelect:stock=>{const input=document.querySelector('#quickcode');input.value=stock.code;input.dispatchEvent(new Event('input',{bubbles:true}));const note=document.querySelector('#poolselection');note.textContent='来自2025年股票池：'+stock.name+'，2025年年报ROE '+stock.roe+'%；以下分析读取最新财报。';note.hidden=false;document.querySelector('#quickform').requestSubmit();document.querySelector('.quickpanel').scrollIntoView({behavior:'smooth',block:'start'});}});
