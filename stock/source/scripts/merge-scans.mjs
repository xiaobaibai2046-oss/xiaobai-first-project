import {readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {mergeSignals,signalCounts,SIGNAL_RULE} from '../signal-model.js';
const root=new URL('../',import.meta.url),file=new URL('pool-signals.json',root),pool=JSON.parse(await readFile(new URL('pool-2025.json',root),'utf8')),codes=new Set(pool.stocks.map(s=>s.code));
const data=JSON.parse(await readFile(file,'utf8'));let results=mergeSignals({},data.results,codes);const batches=[];
const names=await readdir(new URL('scan-results/',root));
for(const name of names.filter(n=>/^shard-\d+\.json$/.test(n))){const part=JSON.parse(await readFile(new URL('scan-results/'+name,root),'utf8'));if(part.rule!==SIGNAL_RULE)throw Error('扫描规则版本不一致');results=mergeSignals(results,part.results,codes);if(part.background)batches.push(part.background)}
if(!batches.length)throw Error('没有可发布的扫描分组；保留原快照');
const unhealthy=batches.filter(b=>b.status!=='batch_complete'),now=new Date().toISOString();
const updated={...data,rule:SIGNAL_RULE,results,finished_at:now,counts:signalCounts(pool.stocks,results),attempted_all:pool.stocks.every(s=>!!results[s.code]),background:{status:unhealthy.length||batches.length<4?'partial':'batch_complete',checked:batches.reduce((n,b)=>n+b.checked,0),batch_total:batches.reduce((n,b)=>n+b.batch_total,0),updated_at:now,shards_received:batches.length,shards_expected:4,batches,message:unhealthy.length||batches.length<4?'部分分组超时、缺失或行情失败，保留已有结果，下轮继续；不代表全池已核验。':null}};
await writeFile(new URL('pool-signals.json.tmp',root),JSON.stringify(updated));await rename(new URL('pool-signals.json.tmp',root),file);console.log(JSON.stringify(updated.background));
