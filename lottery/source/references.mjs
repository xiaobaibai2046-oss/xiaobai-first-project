import {ZONES,absent} from './core.mjs';
export function absenceBlocks(draws,size=100){
  if(!Number.isInteger(size)||size<1)throw new Error('分组大小无效');
  const blocks=[];
  for(let i=0;i<draws.length;i+=size){
    const group=draws.slice(i,i+size),n=group.length;
    const counts=ZONES.map((_,z)=>group.filter(d=>absent(d,z)).length);
    blocks.push({index:blocks.length+1,start:i+1,end:i+n,n,complete:n===size,first:group[0],last:group.at(-1),counts,rates:counts.map(c=>100*c/n)});
  }
  return blocks;
}
export function referenceCSV(blocks){
  return ['区间序号,累计起始期次,累计结束期次,样本期数,是否完整100期,起始期号,结束期号,起始日期,结束日期,一区缺席次数,一区缺席率百分比,二区缺席次数,二区缺席率百分比,三区缺席次数,三区缺席率百分比',...blocks.map(b=>[b.index,b.start,b.end,b.n,b.complete?'是':'否',b.first.issue,b.last.issue,b.first.date,b.last.date,...b.counts.flatMap((c,z)=>[c,b.rates[z].toFixed(4)])].join(','))].join('\n');
}
export function renderReferences(draws){
  const R=id=>document.getElementById(id),blocks=absenceBlocks(draws),full=blocks.filter(b=>b.complete),tail=blocks.filter(b=>!b.complete);
  const colors=['#257eaa','#d67b29','#36805c'],names=['第一区 01—11','第二区 12—22','第三区 23—33'];
  R('reference-meta').textContent=`${draws[0].date}—${draws.at(-1).date}，共${draws.length}期；${full.length}个完整百期区间${tail.length?`＋末尾${tail[0].n}期`:''}。从创立初期顺序、不重叠分组，不是滚动最近100期。导入开奖数据后会重算。`;
  const total=ZONES.map((_,z)=>blocks.reduce((s,b)=>s+b.counts[z],0));
  R('reference-summary').replaceChildren();
  for(let z=0;z<3;z++){
    const tr=document.createElement('tr'),values=full.map(b=>b.rates[z]);
    for(const text of [names[z],`${(100*total[z]/draws.length).toFixed(2)}%（${total[z]}期）`,values.length?`${Math.min(...values).toFixed(0)}%—${Math.max(...values).toFixed(0)}%`:'无完整百期区间']){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    R('reference-summary').append(tr);
  }
  R('reference-rows').replaceChildren();
  const rowNodes=[];
  for(const b of blocks){
    const tr=document.createElement('tr');tr.dataset.block=b.index;
    const texts=[`${b.index}${b.complete?'':'*'}`,`${b.start}—${b.end}`,`${b.first.issue}—${b.last.issue}`,`${b.first.date}—${b.last.date}`,`${b.n}期${b.complete?'':'（不足100）'}`,...b.counts.map((c,z)=>`${b.rates[z].toFixed(2)}%（${c}次）`)];
    for(const text of texts){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    R('reference-rows').append(tr);rowNodes.push(tr);
  }
  const ns='http://www.w3.org/2000/svg';
  function el(tag,attrs={},text){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
  const svg=el('svg',{xmlns:ns,viewBox:'0 0 1050 390',role:'img','aria-labelledby':'reference-title reference-desc'});
  svg.append(el('title',{id:'reference-title'},'双色球每100期各区完全缺席比例'),el('desc',{id:'reference-desc'},'蓝色第一区，橙色第二区，绿色第三区。点选某点显示区间期号与比例。末尾不足100期单独标记。'));
  const width=1050,left=55,right=52,top=38,bottom=300,max=Math.max(16,...blocks.flatMap(b=>b.rates))+2;
  const px=i=>left+(i-1)*(width-left-right)/Math.max(1,blocks.length-1),py=v=>bottom-v/max*(bottom-top);
  svg.append(el('rect',{x:0,y:0,width,height:390,fill:'#fff'}));
  for(let z=0;z<3;z++)svg.append(el('text',{x:left+z*200,y:20,fill:colors[z],'font-size':13},'● '+names[z]));
  svg.append(el('text',{x:675,y:20,fill:'#737b76','font-size':12},'┄ 理论概率 6.74%'));
  for(let v=0;v<=max;v+=2){svg.append(el('line',{x1:left,x2:width-right,y1:py(v),y2:py(v),stroke:'#e3e8e1'}),el('text',{x:left-9,y:py(v)+4,'text-anchor':'end',fill:'#65776c','font-size':12},v+'%'));}
  const theoretical=100*74613/1107568;
  svg.append(el('line',{x1:left,x2:width-right,y1:py(theoretical),y2:py(theoretical),stroke:'#737b76','stroke-dasharray':'6 5'}));
  for(const b of tail)svg.append(el('rect',{x:px(b.index)-12,y:top,width:30,height:bottom-top,fill:'#e7ece5',opacity:.7}));
  for(let z=0;z<3;z++){
    svg.append(el('polyline',{points:full.map(b=>`${px(b.index)},${py(b.rates[z])}`).join(' '),fill:'none',stroke:colors[z],'stroke-width':2}));
    for(const b of blocks){
      const x=px(b.index),y=py(b.rates[z]);
      const g=el('g',{tabindex:0,role:'button','aria-label':`${names[z]} 第${b.index}组 ${b.rates[z].toFixed(2)}%`});
      const title=`第${b.index}组：${b.first.issue}—${b.last.issue}，${b.n}期，${names[z]}缺席${b.counts[z]}次（${b.rates[z].toFixed(2)}%）`;
      g.append(el('title',{},title),el('circle',{cx:x,cy:y,r:10,fill:'transparent'}));
      if(b.complete)g.append(el('circle',{cx:x,cy:y,r:4,fill:colors[z]}));
      else g.append(el('polygon',{points:`${x},${y-6} ${x+6},${y} ${x},${y+6} ${x-6},${y}`,fill:colors[z]}));
      function select(){
        R('reference-selected').textContent=`第${b.index}组 · ${b.first.issue}—${b.last.issue} · ${b.first.date}—${b.last.date} · ${b.n}期${b.complete?'':'（不足100期）'}：${names.map((name,j)=>`${name}缺席${b.counts[j]}次 / ${b.rates[j].toFixed(2)}%`).join('；')}。`;
        rowNodes.forEach(tr=>tr.classList.toggle('selected-reference',Number(tr.dataset.block)===b.index));
      }
      g.onclick=select;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};svg.append(g);
    }
  }
  for(const b of blocks)if(b.index===1||b.index%5===0||!b.complete)svg.append(el('text',{x:px(b.index),y:324,'text-anchor':'middle',fill:'#65776c','font-size':12},String(b.index)+(b.complete?'':'*')));
  svg.append(el('text',{x:width/2,y:355,'text-anchor':'middle',fill:'#65776c','font-size':13},'从第1期开始每100期分组的区间序号；*为末尾不足100期，未连入曲线'));
  svg.append(el('text',{x:left,y:380,fill:'#65776c','font-size':12},`数据截至${draws.at(-1).date}；虚线为理论概率6.74%。缺席是该区一个红球都未出现；历史占比不代表预测。`));
  R('reference-chart').replaceChildren(svg);
  R('reference-selected').textContent='可点选图上的圆点或菱形查看区间详情；手机可左右滑动图表和表格。';
  function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  R('reference-csv').onclick=()=>download('\uFEFF'+referenceCSV(blocks),'双色球每百期各区缺席统计.csv','text/csv;charset=utf-8');
  R('reference-svg').onclick=()=>download(new XMLSerializer().serializeToString(svg),'双色球每百期各区缺席曲线.svg','image/svg+xml;charset=utf-8');
}
