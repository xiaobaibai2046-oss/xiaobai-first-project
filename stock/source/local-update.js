import {SIGNAL_RULE,mergeSignals,signalState,signalCounts,expectedSignalTime} from './signal-model.js';
// Apply only verified, current local results. Cloud results remain for other codes.
export function applyLocalUpdate(snapshot,packet,stocks,now=new Date()){
 if(!packet||packet.rule!==SIGNAL_RULE||packet.schema_version!==1)return snapshot;
 if(typeof packet.run_id!=='string'||!/^[a-f0-9-]{16,64}$/.test(packet.run_id)||!Number.isFinite(Date.parse(packet.generated_at))||Date.parse(packet.generated_at)>now.getTime()+60000)return snapshot;
 const codes=new Set(stocks.map(s=>s.code)),valid=mergeSignals({},packet.results,codes),accepted={};
 for(const [code,r] of Object.entries(valid)){
  if(r.daily_as_of!==expectedSignalTime(now,'daily')||r.hourly_as_of!==expectedSignalTime(now)||signalState(r,now)==='stale')continue;
  if(typeof r.sources?.daily!=='string'||typeof r.sources?.hourly!=='string'||!r.sources.daily.startsWith('大智慧DAD')||!r.sources.hourly.startsWith('大智慧DAD'))continue;
  if(Date.parse(r.checked_at)>now.getTime()+60000||Date.parse(r.checked_at)!==Date.parse(packet.generated_at))continue;
  const previous=snapshot.results?.[code];
  if(previous?.sources?.daily?.startsWith('大智慧DAD')&&previous?.sources?.hourly?.startsWith('大智慧DAD')&&Date.parse(previous.checked_at)>Date.parse(r.checked_at))continue;
  accepted[code]=r;
 }
 if(!Object.keys(accepted).length)return snapshot;
 const results={...snapshot.results,...accepted};
 return {...snapshot,rule:SIGNAL_RULE,results,counts:signalCounts(stocks,results,now),local_update:{run_id:packet.run_id,generated_at:packet.generated_at,applied_at:now.toISOString(),codes:Object.keys(accepted),coverage:Object.keys(accepted).length,total:stocks.length,source:'大智慧本机自动任务'}};
}
