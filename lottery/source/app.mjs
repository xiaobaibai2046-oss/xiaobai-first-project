import {ZONES,key,validate,absent,zoneStats,generate,parseCSV} from './core.mjs';
import {initLedger} from './ledger-ui.mjs';
import {conditionPools,generateStructured} from './conditions.mjs';
import {renderReferences} from './references.mjs';
import {renderIntervals} from './intervals.mjs';
import {planStats,drawBlues,generateCoverage} from './bets.mjs';
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
let draws=[],stats=[],selected=2,combos=[],blues=[],selection=null,eventPage=0,historyPage=0,source='';
const pageSize=25;
const ledger=initLedger({getDraws:()=>draws,getGroups:()=>combos,getZone:()=>selected,getSelection:()=>selection,getBlueMode:()=>$('blue-plan').value,getBlues:()=>blues,getExcludeHistory:()=>$('exclude-history').checked});
const ball=(n,blue=false)=>`<span class="ball${blue?' blue':''}">${pad(n)}</span>`;
const balls=r=>`<span class="balls">${r.map(n=>ball(n)).join('')}</span>`;
const zoneName=z=>['第一区','第二区','第三区'][z];
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function clearCombos(){combos=[];blues=[];selection=null;}
function load(next,label){draws=next;source=label;stats=ZONES.map((_,z)=>zoneStats(draws,z));clearCombos();eventPage=historyPage=0;render();renderReferences(draws);renderIntervals(draws);}
function render(){
  const first=draws[0],last=draws.at(-1);
  const issuesByYear=new Map();
  for(const d of draws){const y=d.issue.slice(0,4);if(!issuesByYear.has(y))issuesByYear.set(y,new Set());issuesByYear.get(y).add(Number(d.issue.slice(4)));}
  let missing=0;
  for(const set of issuesByYear.values())missing+=Math.max(...set)-set.size;
  status(`${source} · ${draws.length}期 · ${first.date} 至 ${last.date}（${last.issue}期）。未与官方逐期核验；按年检测到期号缺口 ${missing} 个（不验证缺失的整个年份、年末记录或日期真实性）。所有状态仅截至该数据末期，不代表实时开奖。`);
  $('zones').innerHTML='';
  for(const s of stats){
    const button=document.createElement('button');button.className='zone'+(s.z===selected?' selected':'');button.setAttribute('aria-pressed',String(s.z===selected));
    button.innerHTML=`<span class="badge ${s.trigger?'active':''}">${s.trigger?'规则已触发':'未触发'}</span><span>${zoneName(s.z)} · ${pad(ZONES[s.z][0])}—${ZONES[s.z][1]}</span><strong>${s.current??'—'} <small style="font-size:14px;font-weight:400">期当前遗漏</small></strong><p>历史平均间隔 ${s.mean===null?'—':s.mean.toFixed(2)} 期 · 2倍阈值 ${s.mean===null?'—':(2*s.mean).toFixed(2)} 期</p><p>缺席 ${s.events.length} 次（${(100*s.rate).toFixed(2)}%）· 最长事件间隔 ${s.max??'—'} 期</p>`;
    button.onclick=()=>{selected=s.z;clearCombos();eventPage=0;render();};$('zones').append(button);
  }
  const s=stats[selected];
  $('generate').disabled=!s.trigger;
  $('rule').textContent=s.trigger?`排除${zoneName(selected)}（${pad(ZONES[selected][0])}—${ZONES[selected][1]}），在另外22个号码中覆盖不同六红。推荐开关仍按历史遗漏两倍均值触发，但这不代表下一期缺区已确定。`:`${zoneName(selected)}未满足严格超过平均间隔2倍的条件，暂停生成。可选择其他已触发区。`;
  $('events-title').textContent=zoneName(selected)+' · 缺席事件时间线';
  renderCost();renderConditions();renderCombos();renderEvents();renderHistory();
}
function conditionOptions(){return {runScope:$('run-scope').value,exactRun:$('exact-run').checked,excludeHistory:$('exclude-history').checked};}
function renderConditions(){
  const enabled=$('structured').checked;
  $('run-scope').disabled=$('exact-run').disabled=!enabled;
  $('run-evidence').replaceChildren();
  if(!enabled){$('condition-info').textContent=`冷热三连号关闭：从剩余22个号码中均匀随机生成不同六红，不固定10、11、12。历史六红${$('exclude-history').checked?'排除':'不排除'}；这些筛选均未证明预测优势。`;return;}
  try{
    const s=conditionPools(draws,selected,conditionOptions());
    const fmt=ns=>ns.map(n=>`${pad(n)}（${s.frequency[n]}次）`).join('、');
    $('condition-info').textContent=`最近50期：${s.windowStart}—${s.windowEnd}。热号池（前6名）：${fmt(s.hot)}。冷号池（后6名）：${fmt(s.cold)}。三连号排除依据：${s.runDrawCount}期开奖，已排除${s.excludedRuns.length}组三连号。允许的角色三连号共${s.runs.length}组：${s.runs.map(p=>p.map(pad).join('—')).join('、')||'无'}。${s.runs.length?'':'当前排除范围无可用三连号，无法推荐；不会放宽。'}冷热仅代表相对频次排名，不是预测概率。`;
    for(const e of s.excludedRuns){const p=document.createElement('p');p.textContent=`${e.triple.map(pad).join('—')}：出现${e.count}期，首次${e.first.issue}（${e.first.date}），最近${e.last.issue}（${e.last.date}）· 最近六红 ${e.last.red.map(pad).join(' ')}。`;$('run-evidence').append(p);}
    if(!s.runs.length)$('generate').disabled=true;
  }catch(e){$('condition-info').textContent=e.message;$('generate').disabled=true;}
}
function renderCost(){
  const count=Number($('count').value),valid=Number.isInteger(count)&&count>=1&&count<=100;
  $('generate').disabled=!stats[selected]?.trigger||!valid;
  const historical=new Set(draws.filter(d=>absent(d,selected)).map(d=>key(d.red))).size;
  if(!valid){$('cost').textContent='请输入1—100之间的整数。';return;}
  const mode=$('blue-plan').value,p=planStats(count,mode),percent=v=>(100*v).toFixed(6)+'%';
  $('cost').textContent=`${count}组不同六红 × ${mode==='single'?'每组1蓝':'每组16蓝'}＝${p.tickets}注，单期${p.cost}元。基础候选${$('exclude-history').checked?74613-historical:74613}组（${$('exclude-history').checked?'已排除历史六红':'历史六红不排除'}）。\n仅在${zoneName(selected)}确实缺席的条件下：至少中一次一等奖或二等奖 ${percent(p.conditionalTopTwo)}（约${Math.round(1/p.conditionalTopTwo).toLocaleString()}分之一）；一等奖单独 ${percent(p.conditionalFirst)}（约${Math.round(1/p.conditionalFirst).toLocaleString()}分之一）。\n开奖前、不假定缺区时：一或二等奖 ${percent(p.overallTopTwo)}，一等奖 ${percent(p.overallFirst)}。各项概率均按公平独立开奖和不同六红计算；小奖不保证，筛选条件未证明额外优势。`;
}
function renderCombos(){
  $('export').disabled=!combos.length;
  $('recommendations').innerHTML=combos.length?combos.map((r,i)=>{const v=selection?.roles[i],single=$('blue-plan').value==='single';return `<article class="combo"><span class="combo-index">组合 ${String(i+1).padStart(2,'0')}</span>${balls(r)}${v?`<small>热号 ${v.hot.map(pad).join(' / ')} · 冷号 ${pad(v.cold)}<br>三连号 ${v.triple.map(pad).join('—')} · 随机号 ${pad(v.random)}</small>`:''}<small>${single?'单个蓝球 · 1注 / 2元':'蓝球全部覆盖 · 16注 / 32元'}</small><div class="all-blue">${single?ball(blues[i],true):Array.from({length:16},(_,j)=>ball(j+1,true)).join('')}</div></article>`;}).join(''):'<p class="muted">尚未生成组合。满足规则后，点击「按规则生成」。</p>';
  ledger.refresh();
}
function paginate(id,page,total,onChange){
  const pages=Math.max(1,Math.ceil(total/pageSize)),el=$(id);el.innerHTML='';
  const prev=document.createElement('button');prev.textContent='上一页';prev.className='secondary';prev.disabled=page===0;prev.onclick=()=>onChange(page-1);
  const text=document.createElement('span');text.textContent=`共${total}条 · ${page+1}/${pages}页`;
  const next=document.createElement('button');next.textContent='下一页';next.className='secondary';next.disabled=page>=pages-1;next.onclick=()=>onChange(page+1);
  el.append(prev,text,next);
}
function renderEvents(){
  const rows=[...stats[selected].events].reverse();
  $('events').innerHTML=rows.slice(eventPage*pageSize,(eventPage+1)*pageSize).map(e=>`<tr><td>${e.draw.issue}</td><td>${e.draw.date}</td><td>${balls(e.draw.red)}</td><td>${ball(e.draw.blue,true)}</td><td>${e.gap===null?'首条记录':e.gap+'期'}</td></tr>`).join('')||'<tr><td colspan="5">没有缺席事件</td></tr>';
  paginate('events-pager',eventPage,rows.length,p=>{eventPage=p;renderEvents();});
}
function renderHistory(){
  const search=$('search').value.trim(),filter=$('filter').value;
  const numeric=/^\d{1,2}$/.test(search)?Number(search):null;
  const rows=[...draws].reverse().filter(d=>(filter===''||absent(d,Number(filter)))&&(!search||(numeric!==null?(d.red.includes(numeric)||d.blue===numeric):(d.issue.includes(search)||d.date.includes(search)))));
  $('history').innerHTML=rows.slice(historyPage*pageSize,(historyPage+1)*pageSize).map(d=>`<tr><td>${d.issue}</td><td>${d.date}</td><td>${balls(d.red)}</td><td>${ball(d.blue,true)}</td><td>${ZONES.map((_,z)=>absent(d,z)?zoneName(z):'').filter(Boolean).join('、')||'—'}</td></tr>`).join('')||'<tr><td colspan="5">没有匹配的开奖记录</td></tr>';
  paginate('history-pager',historyPage,rows.length,p=>{historyPage=p;renderHistory();});
}
function download(text,name,type='text/csv;charset=utf-8'){
  const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('generate').onclick=()=>{try{
  clearCombos();
  if($('structured').checked){const result=generateStructured(draws,selected,Number($('count').value),conditionOptions());combos=result.groups;selection=result.selection;renderConditions();$('condition-info').textContent+=` 全部附加条件过滤后共${selection.candidateCount}组不同六红，本批随机抽取${combos.length}组。`;}
  else combos=generateCoverage(draws,selected,Number($('count').value),{excludeHistory:$('exclude-history').checked});
  if($('blue-plan').value==='single')blues=drawBlues(combos.length);
  renderCombos();
}catch(e){clearCombos();renderCombos();$('condition-info').textContent=e.message;}};
$('count').oninput=()=>{clearCombos();renderCost();renderConditions();renderCombos();};
for(const id of ['blue-plan','exclude-history','structured','run-scope','exact-run'])$(id).onchange=()=>{clearCombos();renderCost();renderConditions();renderCombos();};
$('search').oninput=$('filter').onchange=()=>{historyPage=0;renderHistory();};
$('export').onclick=()=>{
  const mode=$('blue-plan').value,lines=['data_as_of,excluded_zone,red1,red2,red3,red4,red5,red6,blue,cost,selection_rule,hot,cold,triple1,triple2,triple3,random,run_scope,exact_run,blue_plan,exclude_historical_reds'];
  for(const [i,r] of combos.entries())for(const b of mode==='single'?[blues[i]]:Array.from({length:16},(_,j)=>j+1)){const v=selection?.roles[i];lines.push([draws.at(-1).date,selected+1,...r.map(pad),pad(b),2,v?'hot1-cold1-triple3-random1':'zone-random',...(v?[...v.hot,v.cold,...v.triple,v.random].map(pad):Array(6).fill('')),selection?.runScope??'',selection?.exactRun??'',mode,$('exclude-history').checked].join(','));}
  download(lines.join('\n'),`组合-排除${selected+1}区-${draws.at(-1).issue}.csv`);
};
$('export-history').onclick=()=>download(['issue,date,red1,red2,red3,red4,red5,red6,blue',...draws.map(d=>[d.issue,d.date,...d.red.map(pad),pad(d.blue)].join(','))].join('\n'),'双色球历史.csv');
$('file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>15*1024*1024)throw new Error('文件不能超过15MB');
    const text=await file.text();
    const next=file.name.toLowerCase().endsWith('.csv')?parseCSV(text):validate(JSON.parse(text.replace(/^\uFEFF/,'')));
    load(next,'本次导入文件（仅当前页面有效，刷新后恢复内置数据）');
  }catch(err){status('导入失败，原数据保留：'+err.message,true);}
  e.target.value='';
};
try{
  const response=await fetch('./data/history.json');if(!response.ok)throw new Error('数据请求失败：'+response.status);
  const data=await response.json();load(validate(data),'内置历史数据 · 第三方仓库标注来源500.com');
}catch(e){status('加载失败：'+e.message+'。请用 README 中的本地服务器启动，或导入数据文件。',true);}
