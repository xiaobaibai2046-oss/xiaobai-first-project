import {readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {mergeSignals,signalCounts,SIGNAL_RULE,expectedSignalTime} from '../signal-model.js';
const root=new URL('../',import.meta.url),file=new URL('pool-signals.json',root),pool=JSON.parse(await readFile(new URL('pool-2025.json',root),'utf8')),codes=new Set(pool.stocks.map(s=>s.code));
const data=JSON.parse(await readFile(file,'utf8'));let results=mergeSignals({},data.results,codes);const batches=[];
const names=await readdir(new URL('scan-results/',root));
for(const name of names.filter(n=>/^shard-\d+\.json$/.test(n))){const part=JSON.parse(await readFile(new URL('scan-results/'+name,root),'utf8'));if(part.rule!==SIGNAL_RULE)throw Error('扫描规则版本不一致');results=mergeSignals(results,part.results,codes);if(part.background)batches.push(part.background)}
if(!batches.length)throw Error('没有可发布的扫描分组；保留原快照');
const unhealthy=batches.filter(b=>!['batch_complete','budget_reached'].includes(b.status)),now=new Date().toISOString(),counts=signalCounts(pool.stocks,results),partial=unhealthy.length||batches.length<4||counts.pending||counts.incomplete;
const officialHour=Object.values(results).filter(r=>String(r.sources?.hourly||'').startsWith('通达信官方 TdxAiData')&&r.hourly_as_of===expectedSignalTime()).length;
const sdkCalls=batches.reduce((n,b)=>n+(b.provider_stats?.tdx_sdk_calls||0),0);
const message=[batches.some(b=>b.phase==='quick')?'首批结果已发布，后续扫描继续。':'',batches.length<4?'部分分组缺失。':'',unhealthy.length?'部分分组暂停、超时或行情失败。':'',`有效结果 ${counts.buy+counts.sell+counts.none}/${counts.all}；待扫描或更新 ${counts.pending}；数据不足 ${counts.incomplete}。`].join('');
const updated={...data,rule:SIGNAL_RULE,results,started_at:batches.map(b=>b.started_at).filter(t=>Number.isFinite(Date.parse(t))).sort()[0]||data.started_at||now,finished_at:now,counts,attempted_all:pool.stocks.every(s=>!!results[s.code]),background:{status:partial?'partial':'batch_complete',phase:batches[0]?.phase||'full',official_hourly:officialHour,sdk_calls_current_phase:sdkCalls,valid:counts.buy+counts.sell+counts.none,pending:counts.pending,incomplete:counts.incomplete,checked:batches.reduce((n,b)=>n+b.checked,0),batch_total:batches.reduce((n,b)=>n+b.batch_total,0),updated_at:now,shards_received:batches.length,shards_expected:4,batches,message}};
await writeFile(new URL('pool-signals.json.tmp',root),JSON.stringify(updated));await rename(new URL('pool-signals.json.tmp',root),file);console.log(JSON.stringify(updated.background));
