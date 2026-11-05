// Feed real normalized official bars through the unchanged production strategy.
import {readFile} from 'node:fs/promises';
import {summarizeStock,applyAnnualRoeGate} from '../conclusion.js';
import {signalRecord} from '../signal-model.js';
import {validatePool} from '../pool-model.js';
const pool=validatePool(JSON.parse(await readFile(new URL('../pool-2025.json',import.meta.url),'utf8')));
let input='';for await(const part of process.stdin)input+=part;
const results={};
for(const [code,data] of Object.entries(JSON.parse(input))){
 if(data.history?.source!=='通达信官方 TdxAiData 1.3.1'||data.hourly?.source!=='通达信官方 TdxAiData 1.3.1')throw Error('Official-only model acceptance requires verified source provenance');
 if(data.history.bars.length<20||data.hourly.bars.length<100)throw Error('Insufficient real bars for production model');
 const now=new Date(data.now),summary=applyAnnualRoeGate(summarizeStock({code,history:data.history,hourly:data.hourly,now,includeSimulation:false}),pool.stocks.find(s=>s.code===code));
 const record=signalRecord(summary,now);
 if(!summary.technical||!summary.macd)throw Error('Production indicators did not compute');
 results[code]={status:'success',daily_source:data.history.source,hourly_source:data.hourly.source,daily_as_of:record.daily_as_of,hourly_as_of:record.hourly_as_of,MA20:summary.technical.ma20,MACD:summary.macd.latest,roe_gate:summary.roeGate,buy:summary.tradeHints.buy.triggered,sell:summary.tradeHints.sell.triggered,state:record.state,research_status:summary.status,note:'Real official OHLCV passed through existing summarizeStock/signalRecord; no trade orders; full financial summary was not requested'};
}
process.stdout.write(JSON.stringify(results));
