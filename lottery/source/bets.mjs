import {key,randomInt,zoneStats,generate} from './core.mjs';
export function blueModeOf(record){return record.version===1?'all':record.blueMode;}
export function blueMultiplier(mode){if(!['single','all'].includes(mode))throw new Error('蓝球方案无效');return mode==='all'?16:1;}
export function checkBlues(blues,count){
  if(!Array.isArray(blues)||blues.length!==count||blues.some(n=>!Number.isInteger(n)||n<1||n>16))throw new Error('每组六红必须有一个有效蓝球');
}
export function drawBlues(count,rng=randomInt){return Array.from({length:count},()=>rng(16)+1);}
export function planStats(count,mode){
  if(!Number.isInteger(count)||count<1||count>100)throw new Error('每次生成1—100组不同六红');
  const tickets=count*blueMultiplier(mode);
  return {groups:count,tickets,cost:tickets*2,conditionalTopTwo:count/74613,conditionalFirst:tickets/1193808,overallTopTwo:count/1107568,overallFirst:tickets/17721088};
}
export function generateCoverage(draws,zone,count,{excludeHistory=false}={},rng=randomInt){
  planStats(count,'single');
  if(excludeHistory)return generate(draws,zone,count,rng);
  if(!Number.isInteger(zone)||zone<0||zone>2)throw new Error('请选择排除区');
  if(!zoneStats(draws,zone).trigger)throw new Error('该区尚未满足超过平均间隔2倍的条件');
  const pool=Array.from({length:33},(_,i)=>i+1).filter(n=>n<zone*11+1||n>zone*11+11),seen=new Set(),groups=[];
  let attempts=0;
  while(groups.length<count&&attempts++<100000){
    const a=[...pool];for(let i=0;i<6;i++){const j=i+rng(a.length-i);[a[i],a[j]]=[a[j],a[i]];}
    const red=a.slice(0,6).sort((a,b)=>a-b),k=key(red);if(!seen.has(k)){seen.add(k);groups.push(red);}
  }
  if(groups.length!==count)throw new Error('无法完成不重复组合采样，请重新生成');
  return groups;
}
