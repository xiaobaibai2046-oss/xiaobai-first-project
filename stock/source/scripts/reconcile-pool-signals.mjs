import {readFile,writeFile} from 'node:fs/promises';
import {mergeSignals,signalCounts} from '../signal-model.js';
const root=new URL('../',import.meta.url),pool=JSON.parse(await readFile(new URL('pool-2025.json',root))),snapshot=JSON.parse(await readFile(new URL('pool-signals.json',root))),codes=new Set(pool.stocks.map(s=>s.code));
snapshot.results=mergeSignals({},snapshot.results,codes);snapshot.counts=signalCounts(pool.stocks,snapshot.results);snapshot.attempted_all=pool.stocks.every(s=>!!snapshot.results[s.code]);
if(snapshot.background){const c=snapshot.counts;snapshot.background.valid=c.buy+c.sell+c.none;snapshot.background.pending=c.pending;snapshot.background.incomplete=c.incomplete;snapshot.background.historical_today=(snapshot.background.historical_today||[]).filter(s=>codes.has(s.code));snapshot.background.message=`年度股票池已更新；有效结果 ${snapshot.background.valid}/${c.all}，待核验 ${c.pending}，数据不足 ${c.incomplete}。`;if(c.pending)snapshot.background.status='partial'}
await writeFile(new URL('pool-signals.json',root),JSON.stringify(snapshot));
