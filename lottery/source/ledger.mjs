import {key,randomInt,zoneStats} from './core.mjs';
import {checkSelection} from './conditions.mjs';
export const LEDGER_VERSION=1;
export function randomControl(count,rng=randomInt){
  const out=[],seen=new Set();let attempts=0;
  while(out.length<count&&attempts++<100000){
    const a=Array.from({length:33},(_,i)=>i+1);
    for(let i=0;i<6;i++){const j=i+rng(33-i);[a[i],a[j]]=[a[j],a[i]];}
    const r=a.slice(0,6).sort((a,b)=>a-b),k=key(r);
    if(!seen.has(k)){seen.add(k);out.push(r);}
  }
  if(out.length!==count)throw new Error('随机对照生成失败');
  return out;
}
export function checkGroups(groups){
  if(!Array.isArray(groups)||groups.length<1||groups.length>100)throw new Error('组合数量应为1—100');
  for(const r of groups)if(!Array.isArray(r)||r.length!==6||new Set(r).size!==6||r.some(n=>!Number.isInteger(n)||n<1||n>33))throw new Error('六红组合无效');
  if(new Set(groups.map(key)).size!==groups.length)throw new Error('批次内存在重复六红');
}
export function makeRecord({draws,groups,zone,target,cutoff,mode='simulation',records=[],selection=null,now=new Date().toISOString()}){
  checkGroups(groups);
  if(!['simulation','purchased'].includes(mode))throw new Error('记录类型无效');
  if(!/^20\d{5}$/.test(target)||Number(target.slice(4))<1||target<=draws.at(-1).issue)throw new Error('目标期号必须晚于当前数据最新期号');
  if(records.some(r=>r.target===target))throw new Error('该期已有记录；每期仅保留一批，避免事后挑选');
  const deadline=Date.parse(cutoff),time=Date.parse(now);
  if(!Number.isFinite(deadline)||deadline<=time||deadline-time>366*86400000)throw new Error('请填写未来一年内的记录截止时间（北京时间）');
  const targetDate=new Date(deadline+8*3600000).toISOString().slice(0,10);
  if(targetDate.slice(0,4)!==target.slice(0,4)||targetDate<=draws.at(-1).date)throw new Error('目标期号年份、开奖日期与数据末期不一致');
  const s=zoneStats(draws,zone);
  if(!s.trigger)throw new Error('所选区未触发规则');
  const past=new Set(draws.map(d=>key(d.red)));
  if(groups.some(r=>r.some(n=>n>=zone*11+1&&n<=zone*11+11)||past.has(key(r))))throw new Error('组合不符合缺区或历史排除规则');
  if(selection)checkSelection(groups,selection,zone);
  return {version:LEDGER_VERSION,id:globalThis.crypto.randomUUID(),savedAt:now,cutoff:new Date(deadline).toISOString(),target,targetDate,mode,zone,
    source:{issue:draws.at(-1).issue,date:draws.at(-1).date,count:draws.length},rule:{name:'zone-omission-2x-v1',mean:s.mean,current:s.current},
    groups:groups.map(r=>[...r]),control:randomControl(groups.length),cost:groups.length*32,...(selection?{selection:JSON.parse(JSON.stringify(selection))}:{})};
}
export function validateRecord(r){
  if(!r||r.version!==1||typeof r.id!=='string'||!/^[\da-f-]{36}$/i.test(r.id)||!/^20\d{5}$/.test(r.target)||!['simulation','purchased'].includes(r.mode)||!Number.isInteger(r.zone)||r.zone<0||r.zone>2)throw new Error('账本记录格式无效');
  checkGroups(r.groups);checkGroups(r.control);
  if(r.control.length!==r.groups.length||r.cost!==r.groups.length*32||!Number.isFinite(Date.parse(r.savedAt))||!Number.isFinite(Date.parse(r.cutoff))||Date.parse(r.savedAt)>=Date.parse(r.cutoff))throw new Error('账本成本或时间无效');
  const date=new Date(Date.parse(r.cutoff)+8*3600000).toISOString().slice(0,10);
  if(r.targetDate!==date||date.slice(0,4)!==r.target.slice(0,4)||!r.source||!/^20\d{5}$/.test(r.source.issue)||r.source.issue>=r.target||!/^\d{4}-\d{2}-\d{2}$/.test(r.source.date)||r.source.date>=date||!Number.isInteger(r.source.count)||r.source.count<1||!r.rule||r.rule.name!=='zone-omission-2x-v1'||!Number.isFinite(r.rule.mean)||r.rule.mean<=0||!Number.isInteger(r.rule.current)||r.rule.current<=2*r.rule.mean)throw new Error('账本来源或规则无效');
  if(r.groups.some(g=>g.some(n=>n>=r.zone*11+1&&n<=r.zone*11+11)))throw new Error('账本组合包含排除区号码');
  if(r.selection)checkSelection(r.groups,r.selection,r.zone);
  if(r.resultDraw){const d=r.resultDraw;checkGroups([d.red]);if(d.issue!==r.target||d.date!==r.targetDate||!Number.isInteger(d.blue)||d.blue<1||d.blue>16)throw new Error('账本开奖快照无效');}
  return r;
}
export function mergeRecords(current,incoming){
  if(!Array.isArray(incoming)||incoming.length>1000||current.length+incoming.length>2000)throw new Error('账本文件过大');
  const out=[...current],ids=new Map(current.map(r=>[r.id,r])),targets=new Map(current.map(r=>[r.target,r]));
  for(const raw of incoming){const r=validateRecord(raw);
    if(ids.has(r.id)){if(JSON.stringify(ids.get(r.id))!==JSON.stringify(r))throw new Error('相同记录ID存在内容冲突，未导入');continue;}
    if(targets.has(r.target))throw new Error('同一期存在不同记录，未导入');
    out.push(r);ids.set(r.id,r);targets.set(r.target,r);
  }
  if(out.length>1000)throw new Error('最多保存1000期记录，请先导出备份');
  return out;
}
export function settleGroups(groups,draw){
  const levels=[0,0,0,0,0,0],hits=groups.map(r=>r.filter(n=>draw.red.includes(n)).length);
  for(const h of hits){
    if(h===6){levels[0]++;levels[1]+=15;}
    else if(h===5){levels[2]++;levels[3]+=15;}
    else if(h===4){levels[3]++;levels[4]+=15;}
    else if(h===3)levels[4]++;
    else levels[5]++;
  }
  const knownPayout=levels[2]*3000+levels[3]*200+levels[4]*10+levels[5]*5;
  return {levels,knownPayout,unknownPayout:levels[0]>0||levels[1]>0,first:levels[0],redTotal:hits.reduce((a,b)=>a+b,0),bestRed:Math.max(...hits),cost:groups.length*32};
}
export function assessRecord(r,draws){
  const current=draws.find(d=>d.issue===r.target),saved=r.resultDraw;
  if(current&&saved&&(key(current.red)!==key(saved.red)||current.blue!==saved.blue||current.date!==saved.date))return {status:'conflict'};
  const draw=current||saved;
  if(!draw)return {status:'pending'};
  if(draw.date!==r.targetDate)return {status:'conflict'};
  return {status:'settled',draw,strategy:settleGroups(r.groups,draw),control:settleGroups(r.control,draw)};
}
