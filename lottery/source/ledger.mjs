import {key,randomInt,zoneStats} from './core.mjs';
import {checkSelection} from './conditions.mjs';
import {blueModeOf,blueMultiplier,checkBlues,drawBlues} from './bets.mjs';
export const LEDGER_VERSION=2;
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
export function makeRecord({draws,groups,zone,target,cutoff,mode='simulation',records=[],selection=null,blueMode='all',blues=[],excludeHistory=true,scheme='zone',now=new Date().toISOString()}){
  checkGroups(groups);
  const multiplier=blueMultiplier(blueMode);
  if(blueMode==='single')checkBlues(blues,groups.length);
  if(typeof excludeHistory!=='boolean')throw new Error('历史排除选项无效');
  if(!['zone','fixed-triple'].includes(scheme))throw new Error('记录方案无效');
  if(scheme==='fixed-triple'&&(zone!==2||blueMode!=='single'||excludeHistory||selection||groups.some(g=>g.some(n=>n>22)||![10,11,12].every(n=>g.includes(n)))))throw new Error('固定方案必须为01—22、包含10/11/12、每组单蓝且无额外筛选');
  if(!['simulation','purchased'].includes(mode))throw new Error('记录类型无效');
  if(!/^20\d{5}$/.test(target)||Number(target.slice(4))<1||target<=draws.at(-1).issue)throw new Error('目标期号必须晚于当前数据最新期号');
  if(records.some(r=>r.target===target))throw new Error('该期已有记录；每期仅保留一批，避免事后挑选');
  const deadline=Date.parse(cutoff),time=Date.parse(now);
  if(!Number.isFinite(deadline)||deadline<=time||deadline-time>366*86400000)throw new Error('请填写未来一年内的记录截止时间（北京时间）');
  const targetDate=new Date(deadline+8*3600000).toISOString().slice(0,10);
  if(targetDate.slice(0,4)!==target.slice(0,4)||targetDate<=draws.at(-1).date)throw new Error('目标期号年份、开奖日期与数据末期不一致');
  const s=zoneStats(draws,zone);
  if(scheme==='zone'&&!s.trigger)throw new Error('所选区未触发规则');
  const past=new Set(draws.map(d=>key(d.red)));
  if(groups.some(r=>r.some(n=>n>=zone*11+1&&n<=zone*11+11)||(excludeHistory&&past.has(key(r)))))throw new Error('组合不符合缺区或历史排除规则');
  if(selection)checkSelection(groups,selection,zone);
  if(selection&&(selection.excludeHistory??true)!==excludeHistory)throw new Error('历史排除选项与已生成组合不一致');
  return {version:LEDGER_VERSION,id:globalThis.crypto.randomUUID(),savedAt:now,cutoff:new Date(deadline).toISOString(),target,targetDate,mode,zone,
    source:{issue:draws.at(-1).issue,date:draws.at(-1).date,count:draws.length},rule:scheme==='fixed-triple'?{name:'fixed-triple-hypothesis-v1',fixed:[10,11,12],poolMax:22,conditionalUniverse:969,excludeHistory:false}:{name:'zone-omission-2x-v1',mean:s.mean,current:s.current,excludeHistory},
    groups:groups.map(r=>[...r]),control:randomControl(groups.length),blueMode,blues:blueMode==='single'?[...blues]:[],controlBlues:blueMode==='single'?drawBlues(groups.length):[],cost:groups.length*multiplier*2,...(selection?{selection:JSON.parse(JSON.stringify(selection))}:{})};
}
export function validateRecord(r){
  if(!r||![1,2].includes(r.version)||typeof r.id!=='string'||!/^[\da-f-]{36}$/i.test(r.id)||!/^20\d{5}$/.test(r.target)||!['simulation','purchased'].includes(r.mode)||!Number.isInteger(r.zone)||r.zone<0||r.zone>2)throw new Error('账本记录格式无效');
  checkGroups(r.groups);checkGroups(r.control);
  const blueMode=blueModeOf(r),multiplier=blueMultiplier(blueMode);
  if(r.version===1&&(r.blueMode!==undefined||r.blues!==undefined||r.controlBlues!==undefined))throw new Error('旧版账本不可带新版蓝球字段');
  if(r.version===2){if(blueMode==='single'){checkBlues(r.blues,r.groups.length);checkBlues(r.controlBlues,r.control.length);}else if(!Array.isArray(r.blues)||r.blues.length||!Array.isArray(r.controlBlues)||r.controlBlues.length)throw new Error('全蓝账本字段无效');}
  if(r.control.length!==r.groups.length||r.cost!==r.groups.length*multiplier*2||!Number.isFinite(Date.parse(r.savedAt))||!Number.isFinite(Date.parse(r.cutoff))||Date.parse(r.savedAt)>=Date.parse(r.cutoff))throw new Error('账本成本或时间无效');
  const date=new Date(Date.parse(r.cutoff)+8*3600000).toISOString().slice(0,10);
  if(r.targetDate!==date||date.slice(0,4)!==r.target.slice(0,4)||!r.source||!/^20\d{5}$/.test(r.source.issue)||r.source.issue>=r.target||!/^\d{4}-\d{2}-\d{2}$/.test(r.source.date)||r.source.date>=date||!Number.isInteger(r.source.count)||r.source.count<1||!r.rule)throw new Error('账本来源或规则无效');
  if(r.rule.name==='fixed-triple-hypothesis-v1'){
    if(r.version!==2||r.zone!==2||blueMode!=='single'||r.selection||r.rule.excludeHistory!==false||r.rule.poolMax!==22||r.rule.conditionalUniverse!==969||JSON.stringify(r.rule.fixed)!=='[10,11,12]'||r.groups.some(g=>![10,11,12].every(n=>g.includes(n))))throw new Error('固定三连号方案账本无效');
  }else if(r.rule.name!=='zone-omission-2x-v1'||!Number.isFinite(r.rule.mean)||r.rule.mean<=0||!Number.isInteger(r.rule.current)||r.rule.current<=2*r.rule.mean)throw new Error('账本来源或规则无效');
  if(r.groups.some(g=>g.some(n=>n>=r.zone*11+1&&n<=r.zone*11+11)))throw new Error('账本组合包含排除区号码');
  if(r.rule.excludeHistory!==undefined&&typeof r.rule.excludeHistory!=='boolean')throw new Error('历史排除规则无效');
  if(r.selection)checkSelection(r.groups,r.selection,r.zone);
  if(r.selection&&(r.selection.excludeHistory??true)!==(r.rule.excludeHistory??true))throw new Error('历史排除规则不一致');
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
export function settleGroups(groups,draw,blueMode='all',blues=[]){
  const multiplier=blueMultiplier(blueMode);if(blueMode==='single')checkBlues(blues,groups.length);
  const levels=[0,0,0,0,0,0],hits=groups.map(r=>r.filter(n=>draw.red.includes(n)).length);
  for(let i=0;i<hits.length;i++)for(const b of blueMode==='all'?Array.from({length:16},(_,i)=>i+1):[blues[i]]){
    const h=hits[i],blue=b===draw.blue;
    if(h===6)levels[blue?0:1]++;
    else if(h===5)levels[blue?2:3]++;
    else if(h===4)levels[blue?3:4]++;
    else if(h===3&&blue)levels[4]++;
    else if(h<3&&blue)levels[5]++;
  }
  const knownPayout=levels[2]*3000+levels[3]*200+levels[4]*10+levels[5]*5;
  return {levels,knownPayout,unknownPayout:levels[0]>0||levels[1]>0,first:levels[0],second:levels[1],topTwo:levels[0]+levels[1],sixRedGroups:hits.filter(h=>h===6).length,redTotal:hits.reduce((a,b)=>a+b,0),bestRed:Math.max(...hits),cost:groups.length*multiplier*2};
}
export function assessRecord(r,draws){
  const current=draws.find(d=>d.issue===r.target),saved=r.resultDraw;
  if(current&&saved&&(key(current.red)!==key(saved.red)||current.blue!==saved.blue||current.date!==saved.date))return {status:'conflict'};
  const draw=current||saved;
  if(!draw)return {status:'pending'};
  if(draw.date!==r.targetDate)return {status:'conflict'};
  const conditionMet=!draw.red.some(n=>n>=r.zone*11+1&&n<=r.zone*11+11)&&(r.rule.name!=='fixed-triple-hypothesis-v1'||[10,11,12].every(n=>draw.red.includes(n)));
  return {status:'settled',draw,conditionMet,strategy:settleGroups(r.groups,draw,blueModeOf(r),r.blues),control:settleGroups(r.control,draw,blueModeOf(r),r.controlBlues)};
}
