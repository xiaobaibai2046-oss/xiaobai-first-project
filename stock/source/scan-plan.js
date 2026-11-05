import {signalState,expectedSignalTime} from './signal-model.js';
export function shardStocks(stocks,shard=0,shards=1){
 if(!Number.isInteger(shards)||shards<1||shards>16||!Number.isInteger(shard)||shard<0||shard>=shards)throw Error('无效扫描分组');
 return [...stocks].sort((a,b)=>a.code.localeCompare(b.code)).filter((_,i)=>i%shards===shard);
}
export function retryEligible(record,now=new Date()){
 if(signalState(record,now)!=='incomplete')return true;
 const age=now.getTime()-Date.parse(record.checked_at);
 // Missing vendor coverage is retried at the next closed hourly session; network
 // and financial failures get a short cooldown. Neither becomes a no-signal.
 const errors=Object.values(record.errors||{}).join('；');
 const coverage=/没有返回.*m60|未返回.*m60|未返回不复权|历史源没有返回|60分钟价格或重复时间无效/.test(errors);
 return expectedSignalTime(new Date(record.checked_at),'daily')!==expectedSignalTime(now,'daily')||record.checked_session!==expectedSignalTime(now)||age>=(coverage?3600000:300000);
}
const priority=record=>!record?0:record.state==='buy'?0:record.state==='sell'?1:record.state==='none'?2:3;
export function planSignalBatch(stocks,records,{shard=0,shards=1,limit=stocks.length,now=new Date(),generation=null}={}){
 return shardStocks(stocks,shard,shards).filter(s=>generation&&records[s.code]?.market_generation!==generation||!['buy','sell','none'].includes(signalState(records[s.code],now))&&retryEligible(records[s.code],now)).sort((a,b)=>priority(records[a.code])-priority(records[b.code])||(Date.parse(records[a.code]?.checked_at)||0)-(Date.parse(records[b.code]?.checked_at)||0)).slice(0,limit);
}
