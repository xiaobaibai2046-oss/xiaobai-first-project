import {randomInt} from './core.mjs';
import {drawBlues} from './bets.mjs';
export function fixedCandidates(){
  const pool=Array.from({length:22},(_,i)=>i+1).filter(n=>![10,11,12].includes(n)),groups=[];
  for(let a=0;a<pool.length-2;a++)for(let b=a+1;b<pool.length-1;b++)for(let c=b+1;c<pool.length;c++)groups.push([10,11,12,pool[a],pool[b],pool[c]].sort((a,b)=>a-b));
  return groups;
}
export function fixedStats(count){
  if(!Number.isInteger(count)||count<1||count>100)throw new Error('每次生成1—100组不同六红，达到10%至少需97组');
  return {count,tickets:count,cost:count*2,universe:969,conditionalTopTwo:count/969,conditionalFirst:count/15504,overallTopTwo:count/1107568,overallFirst:count/17721088};
}
export function generateFixed(count=97,rng=randomInt){
  const stats=fixedStats(count),all=fixedCandidates();
  for(let i=0;i<count;i++){const j=i+rng(all.length-i);[all[i],all[j]]=[all[j],all[i]];}
  return {groups:all.slice(0,count),blues:drawBlues(count,rng),stats};
}
