export function analyze(bars, capital=100000, riskPct=0.5) {
  if(bars.length<61) throw Error('每只股票至少需要 61 个交易日');
  const last=bars.at(-1), avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const ma20=avg(bars.slice(-20).map(x=>x.close)), ma60=avg(bars.slice(-60).map(x=>x.close));
  const tr=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));
  const atr=avg(tr.slice(-14)); // Simple 14-session mean of true range, not Wilder smoothing.
  const previousVolume=avg(bars.slice(-21,-1).map(x=>x.volume));
  const ratio=previousVolume>0?last.volume/previousVolume:null;
  const stop=last.close-2*atr;
  const riskShares=atr>0&&stop>0?Math.floor(capital*riskPct/100/(2*atr)/100)*100:0;
  const cashShares=Math.floor(capital/last.close/100)*100;
  const shares=Math.min(riskShares,cashShares);
  return {code:last.code,name:last.name,date:last.date,close:last.close,ma20,ma60,atr,ratio,stop,shares,trend:last.close>ma20&&ma20>ma60,notional:shares*last.close};
}
export function parseCSV(text) {
 const rows=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(line=>line.split(',').map(x=>x.trim()));
 const header=rows.shift(), required=['code','name','date','open','high','low','close','volume'];
 if(required.some(k=>!header.includes(k))) throw Error('缺少列：'+required.join(','));
 const groups=new Map(), seen=new Set();
 for(const [i,row] of rows.entries()) {
  if(row.length!==header.length) throw Error(`第 ${i+2} 行列数错误（不支持字段内逗号）`);
  const b=Object.fromEntries(header.map((k,j)=>[k,row[j]]));
  for(const k of ['open','high','low','close','volume']) {if(b[k]==='')throw Error(`第 ${i+2} 行 ${k} 为空`);b[k]=Number(b[k]);}
  if(!/^\d{6}$/.test(b.code)||!b.name||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||isNaN(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date||b.date>new Date().toISOString().slice(0,10)||!['open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||Math.min(b.open,b.high,b.low,b.close)<=0||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.high<b.low) throw Error(`第 ${i+2} 行行情无效`);
  const key=b.code+b.date;if(seen.has(key))throw Error(`第 ${i+2} 行股票日期重复`);seen.add(key);
  if(!groups.has(b.code))groups.set(b.code,[]);groups.get(b.code).push(b);
 }
 if(!groups.size)throw Error('没有行情记录');
 for(const bars of groups.values())bars.sort((a,b)=>a.date.localeCompare(b.date));
 return groups;
}
export function demoCSV(){
 const lines=['code,name,date,open,high,low,close,volume'];
 for(let s=0;s<4;s++)for(let i=0;i<100;i++){
  const d=new Date(Date.UTC(2025,0,1+i));if([0,6].includes(d.getUTCDay()))continue;
  const p=12+s*8+i*(s===2?-.025:.035)+Math.sin(i/6+s)*.3;
  lines.push([String(s+1).padStart(6,'0'),'模拟股票'+(s+1),d.toISOString().slice(0,10),p.toFixed(2),(p+.4).toFixed(2),(p-.4).toFixed(2),(p+.1).toFixed(2),100000+i*1000+s*3000].join(','));
 }return lines.join('\n');
}
