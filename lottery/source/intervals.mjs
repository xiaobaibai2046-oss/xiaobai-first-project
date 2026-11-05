import {ZONES,absent} from './core.mjs';
export const GAP_BINS=[[1,5],[6,10],[11,20],[21,30],[31,40],[41,60],[61,Infinity]];
export function intervalAnalysis(draws){
  return ZONES.map((_,zone)=>{
    const flags=draws.map(d=>absent(d,zone)),indices=flags.flatMap((yes,i)=>yes?[i]:[]);
    const intervals=indices.slice(1).map((to,i)=>({zone,from:draws[indices[i]],to:draws[to],gap:to-indices[i],between:to-indices[i]-1}));
    const gaps=intervals.map(r=>r.gap),sorted=[...gaps].sort((a,b)=>a-b),n=gaps.length;
    const mean=n?gaps.reduce((a,b)=>a+b,0)/n:null;
    const median=n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:null;
    const q95=n?sorted[Math.ceil((n-1)*.95)]:null;
    const counts=GAP_BINS.map(([lo,hi])=>gaps.filter(v=>v>=lo&&v<=hi).length);
    const last=indices.length?draws[indices.at(-1)]:null,current=indices.length?draws.length-1-indices.at(-1):null;
    const train=indices.filter(i=>draws[i].date<'2015-01-01');
    const threshold=train.length>1?2*(train.at(-1)-train[0])/(train.length-1):null;
    let age=0,seen=false;
    const validation=[{start:'2015-01-01',end:'2021-01-01',n:0,hits:0},{start:'2021-01-01',end:'9999-01-01',n:0,hits:0}];
    for(let i=0;i<draws.length;i++){
      if(threshold!==null&&seen&&age>threshold)for(const period of validation)if(draws[i].date>=period.start&&draws[i].date<period.end){period.n++;period.hits+=Number(flags[i]);}
      if(flags[i]){seen=true;age=0;}else if(seen)age++;
    }
    return {zone,events:indices.length,intervals,n,mean,median,q95,min:n?sorted[0]:null,max:n?sorted.at(-1):null,current,last,leading:indices.length?indices[0]:draws.length,counts,rates:counts.map(c=>n?100*c/n:0),threshold,validation};
  });
}
export function intervalCSV(analysis){
  return ['分区,前次缺席期号,前次缺席日期,后次缺席期号,后次缺席日期,事件间隔期数,中间连续未发生缺席期数,前次六红,后次六红',...analysis.flatMap(s=>s.intervals.map(r=>[s.zone+1,r.from.issue,r.from.date,r.to.issue,r.to.date,r.gap,r.between,r.from.red.join(' '),r.to.red.join(' ')].join(',')))].join('\n');
}
export function renderIntervals(draws){
  const I=id=>document.getElementById(id),analysis=intervalAnalysis(draws),names=['第一区 01—11','第二区 12—22','第三区 23—33'],colors=['#257eaa','#d67b29','#36805c'];
  const value=(n,digits=0)=>n===null?'—':n.toFixed(digits);
  function row(parent,texts){const tr=document.createElement('tr');for(const text of texts){const td=document.createElement('td');td.textContent=text;tr.append(td);}parent.append(tr);}
  I('interval-meta').textContent=`${draws[0].date}—${draws.at(-1).date}，共${draws.length}期。事件间隔＝相邻两次该区完全缺席的开奖期数差；间隔1期代表连续两期缺席。开头未观察到前次事件的部分及当前尚未结束的遗漏均不计入完整间隔。`;
  I('interval-summary').replaceChildren();I('interval-distribution').replaceChildren();I('interval-maxima').replaceChildren();I('interval-validation').replaceChildren();
  for(const s of analysis){
    row(I('interval-summary'),[names[s.zone],s.events,s.n,value(s.mean,2),value(s.median),value(s.q95),value(s.min),value(s.max),value(s.current)]);
    for(const r of s.intervals.filter(r=>r.gap===s.max))row(I('interval-maxima'),[names[s.zone],`${r.from.issue} / ${r.from.date}`,`${r.to.issue} / ${r.to.date}`,`${r.gap}期（中间${r.between}期未发生）`]);
    const stats=s.validation.map(v=>s.threshold===null?'训练数据不足':v.n?`${v.hits}/${v.n}＝${(100*v.hits/v.n).toFixed(2)}%`:'无触发样本');
    row(I('interval-validation'),[names[s.zone],s.threshold===null?'训练数据不足':value(s.threshold,2)+'期',...stats]);
  }
  for(let b=0;b<GAP_BINS.length;b++)row(I('interval-distribution'),[b===6?'61期及以上':`${GAP_BINS[b][0]}—${GAP_BINS[b][1]}期`,...analysis.map(s=>`${s.counts[b]}个 / ${s.rates[b].toFixed(2)}%`)]);
  const observations=analysis.map(s=>`${names[s.zone]}：当前${s.current===null?'未观察到缺席事件':`遗漏${s.current}期`}，历史平均${value(s.mean,2)}期${s.current!==null&&s.q95!==null&&s.current>s.q95?'；当前已超过完整间隔的95%分位数':''}。`);
  I('interval-analysis').textContent=observations.join('\n')+'\n三区各有11个号码，公平独立开奖下理论缺席概率均为6.74%，理论平均间隔约14.84期。历史均值、中位数和最长纪录不构成下一次的期限；当前未完成间隔不能直接当成已完成间隔比较后推断“快到头”。';
  let page=0;const size=25;
  function renderList(){
    const filter=I('interval-zone').value,all=analysis.flatMap(s=>s.intervals).filter(r=>filter===''||r.zone===Number(filter)).sort((a,b)=>b.to.issue.localeCompare(a.to.issue)||a.zone-b.zone);
    const pages=Math.max(1,Math.ceil(all.length/size));page=Math.min(page,pages-1);I('interval-list').replaceChildren();
    for(const r of all.slice(page*size,(page+1)*size))row(I('interval-list'),[names[r.zone],r.from.issue,r.from.date,r.to.issue,r.to.date,r.gap,r.between,r.from.red.join(' '),r.to.red.join(' ')]);
    I('interval-page').textContent=`共${all.length}个完整间隔 · ${page+1}/${pages}页`;
    I('interval-prev').disabled=page===0;I('interval-next').disabled=page>=pages-1;
  }
  I('interval-zone').onchange=()=>{page=0;renderList();};I('interval-prev').onclick=()=>{page--;renderList();};I('interval-next').onclick=()=>{page++;renderList();};renderList();
  const ns='http://www.w3.org/2000/svg';
  function element(tag,attrs={},text){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
  const svg=element('svg',{xmlns:ns,viewBox:'0 0 1050 410',role:'img','aria-label':'各区完整缺席间隔分布，柱高为区间比例，标注为间隔数量'}),left=55,bottom=315,top=62;
  const p=74613/1107568,theory=GAP_BINS.map(([lo,hi])=>100*((1-p)**(lo-1)-(hi===Infinity?0:(1-p)**hi)));
  const max=Math.ceil(Math.max(40,...analysis.flatMap(s=>s.rates),...theory)/10)*10,py=v=>bottom-v/max*(bottom-top),px=i=>left+70+i*133;
  svg.append(element('rect',{width:1050,height:410,fill:'white'}));
  for(let z=0;z<3;z++)svg.append(element('text',{x:left+z*225,y:22,fill:colors[z],'font-size':13},`■ ${names[z]}（${analysis[z].n}个）`));
  svg.append(element('text',{x:left,y:46,fill:'#65776c','font-size':12},'柱高＝本区完整间隔比例；数字＝完整间隔个数；灰色虚线＝公平独立模型分布'));
  for(let v=0;v<=max;v+=max>60?20:10)svg.append(element('line',{x1:left,x2:1030,y1:py(v),y2:py(v),stroke:'#e3e8e1'}),element('text',{x:left-8,y:py(v)+4,'text-anchor':'end','font-size':12,fill:'#65776c'},v+'%'));
  for(let b=0;b<7;b++){
    for(let z=0;z<3;z++){
      const s=analysis[z],x=px(b)+(z-1)*28-12,y=py(s.rates[b]);
      const rect=element('rect',{x,y,width:24,height:bottom-y,fill:colors[z]});rect.append(element('title',{},`${names[z]} ${GAP_BINS[b][0]}—${GAP_BINS[b][1]===Infinity?'∞':GAP_BINS[b][1]}期：${s.counts[b]}个 / ${s.rates[b].toFixed(2)}%`));svg.append(rect,element('text',{x:x+12,y:y-5,'text-anchor':'middle','font-size':11,fill:colors[z]},String(s.counts[b])));
    }
    svg.append(element('text',{x:px(b),y:337,'text-anchor':'middle','font-size':12,fill:'#65776c'},b===6?'61期及以上':`${GAP_BINS[b][0]}—${GAP_BINS[b][1]}期`));
  }
  svg.append(element('polyline',{points:theory.map((v,i)=>`${px(i)},${py(v)}`).join(' '),stroke:'#737b76','stroke-dasharray':'6 5','stroke-width':2,fill:'none'}));
  svg.append(element('text',{x:left,y:370,fill:'#65776c','font-size':12},'区间宽度不同，柱高是各区间的总比例；当前未完成遗漏单列，不计入柱形分布。'));
  svg.append(element('text',{x:left,y:395,fill:'#65776c','font-size':12},`数据截至${draws.at(-1).date}，第三方记录未逐期官方核验；历史间隔不能预测下一期。`));I('interval-chart').replaceChildren(svg);
  function download(text,name,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  I('interval-export').onclick=()=>download('\uFEFF'+intervalCSV(analysis),'双色球各区完整缺席间隔.csv','text/csv;charset=utf-8');
  I('interval-export-summary').onclick=()=>{
    const lines=['分区,缺席次数,完整间隔数,平均间隔,中位数,95%分位数_向上取值,最短间隔,最长间隔,当前未完成遗漏',...analysis.map(s=>[s.zone+1,s.events,s.n,value(s.mean,4),value(s.median),value(s.q95),value(s.min),value(s.max),value(s.current)].join(','))];
    download('\uFEFF'+lines.join('\n'),'双色球各区缺席间隔汇总.csv','text/csv;charset=utf-8');
  };
  I('interval-export-svg').onclick=()=>download(new XMLSerializer().serializeToString(svg),'双色球各区缺席间隔分布.svg','image/svg+xml;charset=utf-8');
}
