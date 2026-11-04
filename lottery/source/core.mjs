export const ZONES = [[1,11],[12,22],[23,33]];
export const key = r => [...r].sort((a,b)=>a-b).join(',');
export function validate(input) {
  const records = Array.isArray(input) ? input : input.draws;
  if (!Array.isArray(records) || !records.length) throw new Error('没有有效的开奖记录');
  const seen = new Set();
  const draws = records.map(d => {
    let issue = String(d.issue ?? '').trim();
    if (/^\d{5}$/.test(issue)) issue = '20'+issue;
    const red = Array.isArray(d.red) ? d.red.map(Number) : [];
    const blue = Number(Array.isArray(d.blue) ? d.blue[0] : d.blue);
    const date = String(d.date ?? '');
    if (!/^20\d{5}$/.test(issue) || Number(issue.slice(4)) < 1 || seen.has(issue)) throw new Error('期号无效或重复：'+issue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || date.slice(0,4)!==issue.slice(0,4)) throw new Error('日期无效：'+issue);
    if (red.length!==6 || new Set(red).size!==6 || red.some(n=>!Number.isInteger(n)||n<1||n>33) || !Number.isInteger(blue)||blue<1||blue>16) throw new Error('号码无效：'+issue);
    seen.add(issue);
    return {issue,date,red:red.sort((a,b)=>a-b),blue};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  if (draws.some((d,i)=>i>0&&(d.date===draws[i-1].date||d.issue<=draws[i-1].issue))) throw new Error('日期或期号顺序冲突');
  return draws;
}
export const absent = (draw,z) => !draw.red.some(n=>n>=ZONES[z][0]&&n<=ZONES[z][1]);
export function zoneStats(draws,z) {
  const events=[];
  draws.forEach((d,i)=>{if(absent(d,z))events.push({draw:d,index:i,gap:events.length?i-events.at(-1).index:null});});
  const gaps=events.slice(1).map(e=>e.gap);
  const mean=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null;
  const current=events.length?draws.length-1-events.at(-1).index:null;
  return {z,events,mean,current,max:gaps.length?Math.max(...gaps):null,trigger:mean!==null&&current>2*mean,rate:events.length/draws.length};
}
export function randomInt(max) {
  const x=new Uint32Array(1), limit=Math.floor(4294967296/max)*max;
  do { globalThis.crypto.getRandomValues(x); } while(x[0]>=limit);
  return x[0]%max;
}
export function generate(draws,z,count,rng=randomInt) {
  if(!Number.isInteger(z)||z<0||z>2) throw new Error('请选择排除区');
  if(!Number.isInteger(count)||count<1||count>100) throw new Error('每次生成1—100组');
  if(!zoneStats(draws,z).trigger) throw new Error('该区尚未满足超过平均间隔2倍的条件');
  const historical=new Set(draws.map(d=>key(d.red))),used=new Set(),out=[];
  const pool=Array.from({length:33},(_,i)=>i+1).filter(n=>n<ZONES[z][0]||n>ZONES[z][1]);
  let attempts=0;
  while(out.length<count&&attempts++<100000) {
    const a=[...pool];
    for(let i=0;i<6;i++){const j=i+rng(a.length-i);[a[i],a[j]]=[a[j],a[i]];}
    const red=a.slice(0,6).sort((a,b)=>a-b),k=key(red);
    if(!historical.has(k)&&!used.has(k)){used.add(k);out.push(red);}
  }
  if(out.length!==count)throw new Error('未能完成采样，请重新生成');
  return out;
}
export function parseCSV(text) {
  const rows=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(r=>r.split(',').map(s=>s.trim()));
  const expected=['issue','date','red1','red2','red3','red4','red5','red6','blue'];
  if(rows[0]?.join(',')!==expected.join(','))throw new Error('CSV表头应为：'+expected.join(','));
  return validate(rows.slice(1).filter(r=>r.some(Boolean)).map(r=>({issue:r[0],date:r[1],red:r.slice(2,8),blue:r[8]})));
}
