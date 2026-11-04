import {key,randomInt,zoneStats,absent} from './core.mjs';
export function conditionPools(draws,zone,{runScope='zoneHistory',exactRun=true}={}){
  if(draws.length<50)throw new Error('冷热条件至少需要50期开奖');
  if(!Number.isInteger(zone)||zone<0||zone>2||!['all','recent50','whole','zoneHistory'].includes(runScope)||typeof exactRun!=='boolean')throw new Error('条件选项无效');
  const pool=Array.from({length:33},(_,i)=>i+1).filter(n=>n<zone*11+1||n>zone*11+11);
  const recent=draws.slice(-50),frequency=Object.fromEntries(pool.map(n=>[n,0]));
  for(const d of recent)for(const n of d.red)if(n in frequency)frequency[n]++;
  const ranked=[...pool].sort((a,b)=>frequency[b]-frequency[a]||a-b);
  const hot=ranked.slice(0,6),cold=ranked.slice(-6).reverse();
  const runDraws=runScope==='zoneHistory'?draws.filter(d=>absent(d,zone)):runScope==='recent50'?recent:draws;
  const eligible=pool.filter(n=>pool.includes(n+1)&&pool.includes(n+2)).map(n=>[n,n+1,n+2]);
  const runs=[],excludedRuns=[];
  for(const triple of eligible){
    const events=runScope==='whole'?[]:runDraws.filter(d=>triple.every(n=>d.red.includes(n)));
    if(events.length)excludedRuns.push({triple,count:events.length,first:events[0],last:events.at(-1)});
    else runs.push(triple);
  }
  return {version:1,runLength:3,window:50,runScope,exactRun,hot,cold,frequency,runs,pool,runDrawCount:runScope==='whole'?0:runDraws.length,excludedRuns,windowStart:recent[0].issue,windowEnd:recent.at(-1).issue};
}
export function structuredCandidates(draws,zone,options={}){
  const summary=conditionPools(draws,zone,options),past=new Set(draws.map(d=>key(d.red))),found=new Map();
  const {hot,cold,runs,exactRun,pool}=summary;
  for(const triple of runs)for(const h of hot)for(const c of cold){
    const base=[h,c,...triple];if(new Set(base).size!==5)continue;
    for(const random of pool){
    if(base.includes(random))continue;
    const red=[...base,random].sort((x,y)=>x-y);
    // Exactly two adjacent edges means a single length-3 run and no extra pair.
    if(exactRun&&red.slice(1).filter((n,i)=>n===red[i]+1).length!==2)continue;
    const k=key(red);if(past.has(k)||found.has(k))continue;
    found.set(k,{red,roles:{hot:[h],cold:c,triple:[...triple],random}});
    }
  }
  return {summary,candidates:[...found.values()]};
}
export function generateStructured(draws,zone,count,options={},rng=randomInt){
  if(!Number.isInteger(count)||count<1||count>100)throw new Error('每次生成1—100组');
  if(!zoneStats(draws,zone).trigger)throw new Error('该区尚未满足超过平均间隔2倍的条件');
  const {summary,candidates}=structuredCandidates(draws,zone,options);
  if(candidates.length<count)throw new Error(`条件下仅有${candidates.length}组不同六红，无法生成${count}组。请调整数量或条件；不会自动放宽。`);
  const available=candidates.length;
  for(let i=0;i<count;i++){const j=i+rng(candidates.length-i);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const chosen=candidates.slice(0,count);
  return {groups:chosen.map(c=>c.red),selection:{...summary,candidateCount:available,roles:chosen.map(c=>c.roles)}};
}
export function checkSelection(groups,selection,zone){
  if(!selection||selection.version!==1||selection.runLength!==3||selection.window!==50||!['all','recent50','whole','zoneHistory'].includes(selection.runScope)||typeof selection.exactRun!=='boolean'||!Array.isArray(selection.hot)||!Array.isArray(selection.cold)||selection.hot.length!==6||selection.cold.length!==6||new Set([...selection.hot,...selection.cold]).size!==12||[...selection.hot,...selection.cold].some(n=>!Number.isInteger(n)||n<1||n>33||(n>=zone*11+1&&n<=zone*11+11))||!Array.isArray(selection.roles)||selection.roles.length!==groups.length)throw new Error('冷热三连号条件快照无效');
  for(let i=0;i<groups.length;i++){
    const role=selection.roles[i];
    if(!role||!Array.isArray(role.hot)||role.hot.length!==1||role.hot.some(n=>!selection.hot.includes(n))||!selection.cold.includes(role.cold)||!Number.isInteger(role.random)||!Array.isArray(role.triple)||role.triple.length!==3||role.triple.some(n=>!Number.isInteger(n))||role.triple[1]!==role.triple[0]+1||role.triple[2]!==role.triple[0]+2||!Array.isArray(selection.runs)||!selection.runs.some(r=>key(r)===key(role.triple))||key([...role.hot,role.cold,...role.triple,role.random])!==key(groups[i]))throw new Error('号码角色与三连号条件快照不一致');
    const red=[...groups[i]].sort((a,b)=>a-b);if(selection.exactRun&&red.slice(1).filter((n,j)=>n===red[j]+1).length!==2)throw new Error('组合不满足恰好一组三连号');
  }
}
