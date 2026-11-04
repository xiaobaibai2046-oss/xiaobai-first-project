import {ZONES,key,validate,absent,zoneStats,generate,parseCSV} from './core.mjs';
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
let draws=[],stats=[],selected=2,combos=[],eventPage=0,historyPage=0,source='';
const pageSize=25;
const ball=(n,blue=false)=>`<span class="ball${blue?' blue':''}">${pad(n)}</span>`;
const balls=r=>`<span class="balls">${r.map(n=>ball(n)).join('')}</span>`;
const zoneName=z=>['第一区','第二区','第三区'][z];
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function load(next,label){draws=next;source=label;stats=ZONES.map((_,z)=>zoneStats(draws,z));combos=[];eventPage=historyPage=0;render();}
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
    button.onclick=()=>{selected=s.z;combos=[];eventPage=0;render();};$('zones').append(button);
  }
  const s=stats[selected];
  $('generate').disabled=!s.trigger;
  $('rule').textContent=s.trigger?`排除${zoneName(selected)}（${pad(ZONES[selected][0])}—${ZONES[selected][1]}），从另外22个号码中选6个；仅排除历史六红组合，不做热号排序。`:`${zoneName(selected)}未满足严格超过平均间隔2倍的条件，暂停生成。可选择其他已触发区。`;
  $('events-title').textContent=zoneName(selected)+' · 缺席事件时间线';
  renderCost();renderCombos();renderEvents();renderHistory();
}
function renderCost(){
  const count=Number($('count').value),valid=Number.isInteger(count)&&count>=1&&count<=100;
  $('generate').disabled=!stats[selected]?.trigger||!valid;
  const historical=new Set(draws.filter(d=>absent(d,selected)).map(d=>key(d.red))).size;
  $('cost').textContent=valid?`计划 ${count} 组六红 × 16蓝 ＝ ${count*16} 注 · 单期总成本 ${count*32} 元。排除 ${historical} 组已开奖六红，剩余候选 ${74613-historical} 组。公平模型下，这 ${count} 组的一等奖概率仍为 ${count}/1,107,568（约 ${(100*count/1107568).toFixed(6)}%），不因本规则而提高。`:'请输入1—100之间的整数。';
}
function renderCombos(){
  $('export').disabled=!combos.length;
  $('recommendations').innerHTML=combos.length?combos.map((r,i)=>`<article class="combo"><span class="combo-index">组合 ${String(i+1).padStart(2,'0')}</span>${balls(r)}<small>蓝球全部覆盖 · 16注 / 32元</small><div class="all-blue">${Array.from({length:16},(_,j)=>ball(j+1,true)).join('')}</div></article>`).join(''):'<p class="muted">尚未生成组合。满足规则后，点击「按规则生成」。</p>';
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
$('generate').onclick=()=>{try{combos=generate(draws,selected,Number($('count').value));renderCombos();}catch(e){status(e.message,true);}};
$('count').oninput=()=>{combos=[];renderCost();renderCombos();};
$('search').oninput=$('filter').onchange=()=>{historyPage=0;renderHistory();};
$('export').onclick=()=>{
  const lines=['data_as_of,excluded_zone,red1,red2,red3,red4,red5,red6,blue,cost'];
  for(const r of combos)for(let b=1;b<=16;b++)lines.push([draws.at(-1).date,selected+1,...r.map(pad),pad(b),2].join(','));
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
