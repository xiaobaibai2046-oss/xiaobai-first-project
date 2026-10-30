import {signalState} from './signal-model.js';
export function shardStocks(stocks,shard=0,shards=1){
 if(!Number.isInteger(shards)||shards<1||shards>16||!Number.isInteger(shard)||shard<0||shard>=shards)throw Error('无效扫描分组');
 return [...stocks].sort((a,b)=>a.code.localeCompare(b.code)).filter((_,i)=>i%shards===shard);
}
export function planSignalBatch(stocks,records,{shard=0,shards=1,limit=stocks.length,now=new Date()}={}){
 return shardStocks(stocks,shard,shards).filter(s=>!['buy','sell','none'].includes(signalState(records[s.code],now))).sort((a,b)=>(Date.parse(records[a.code]?.checked_at)||0)-(Date.parse(records[b.code]?.checked_at)||0)).slice(0,limit);
}
