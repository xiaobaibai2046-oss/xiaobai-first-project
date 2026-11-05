import {isTradingDay} from './trading-calendar.js';
import {TRUE_DIF_STAGE_BARS,TRUE_DIF_VOLUME_BARS} from './strategy-config.js';
export const SIGNAL_RULE='roe2025-true-dif-waves-v5-stage'+TRUE_DIF_STAGE_BARS+'-vol'+TRUE_DIF_VOLUME_BARS+'-first2';
const sessionCache=new Map();
export function expectedSignalTime(now=new Date(),kind='hourly'){
 const cacheKey=kind+'|'+Math.floor(now.getTime()/60000);if(sessionCache.has(cacheKey))return sessionCache.get(cacheKey);
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));let d=new Date(Date.UTC(+p.year,+p.month-1,+p.day));const weekday=d.getUTCDay(),time=+p.hour*60+(+p.minute);let hm=null;
 if(isTradingDay(d.toISOString().slice(0,10))){if(kind==='daily'&&time>=15*60)hm='1500';if(kind==='hourly')hm=['1030','1130','1400','1500'].filter(x=>(+x.slice(0,2))*60+(+x.slice(2))<=time).at(-1)||null}
 if(!hm){do{d.setUTCDate(d.getUTCDate()-1)}while(!isTradingDay(d.toISOString().slice(0,10)));hm='1500'}const date=d.toISOString().slice(0,10);const value=kind==='daily'?date:`${date}T${hm.slice(0,2)}:${hm.slice(2)}:00+08:00`;if(sessionCache.size>32)sessionCache.delete(sessionCache.keys().next().value);sessionCache.set(cacheKey,value);return value;
}
export function signalRecord(summary,checkedAt=new Date()){
 const day=summary.technical?.date||null,hour=summary.macd?.asOf||null;
 const dailyOK=!!day&&day===expectedSignalTime(checkedAt,'daily'),hourlyOK=!!hour&&hour===expectedSignalTime(checkedAt);
 const daySell=dailyOK&&summary.technical?.close<summary.technical?.ma20,topSell=hourlyOK&&summary.macd?.bearish?.active;
 let state,dependencies={daily:true,hourly:true},reasons=[];
 if(hourlyOK&&summary.tradeHints.buy.triggered){state='buy';dependencies={daily:false,hourly:true};reasons=summary.tradeHints.buy.reasons}
 else if(daySell||topSell){state='sell';dependencies={daily:!!daySell,hourly:!daySell};reasons=summary.tradeHints.sell.reasons}
 else if(!dailyOK||!hourlyOK){state='incomplete';reasons=[...(!dailyOK?['日线未更新，卖出条件未完整核验']:[]),...(!hourlyOK?['60分钟数据未更新至最新已完成时段']:[]),...summary.missing.filter(x=>/日线|60分钟|K线|成交量|MACD/.test(x)),...Object.values(summary.errors||{})]}
 else{state='none';reasons=[...summary.tradeHints.buy.reasons,...summary.tradeHints.sell.reasons]}

 const event=e=>e?{first_time:e.firstTime,second_time:e.secondTime,confirmed_at:e.confirmedAt,active:e.active,level:e.level||null,risk_active:!!e.riskActive,mode:e.mode||'pivot',previous_low_volume_mean:e.previousLowVolumeMean??null,current_volume:e.currentVolume??null,volume_ratio:e.volumeRatio??null,first_green_peak:e.firstGreenPeak??null,second_green_peak:e.secondGreenPeak??null,first_min_dif:e.firstMinDIF??null,second_min_dif:e.secondMinDIF??null,price_match:e.priceMatch,price_change_pct:e.priceChangePct,price_tolerance:e.priceTolerance}:null;
 return {rule:SIGNAL_RULE,code:summary.code,state,timing:{bottom:event(summary.macd?.bullish),top:event(summary.macd?.bearish),daily_above_ma20:dailyOK?!!summary.technical?.trend:null},checked_at:checkedAt.toISOString(),checked_session:expectedSignalTime(checkedAt),daily_as_of:day,hourly_as_of:hour,dependencies,signals:{buy:state==='buy',sell:!!(daySell||topSell)},sell_reasons:summary.tradeHints.sell.reasons,reasons:[...new Set(reasons)].slice(0,12),errors:summary.errors||{},sources:summary.signalSources||{},source_status:summary.signalStatus||{}};
}
export function signalState(record,now=new Date()){
 if(!record)return 'unscanned';if(record.rule!==SIGNAL_RULE||!['buy','sell','none','incomplete'].includes(record.state)||!Number.isFinite(Date.parse(record.checked_at))||Date.parse(record.checked_at)>now.getTime()+60000)return 'stale';
 if(record.state==='buy'&&!record.dependencies?.hourly||record.state==='sell'&&!record.dependencies?.daily&&!record.dependencies?.hourly||record.state==='none'&&(!record.dependencies?.daily||!record.dependencies?.hourly))return 'stale';
 if(record.state==='buy'&&(record.timing?.bottom?.mode!=='true_dif_waves'||![1,2].includes(record.timing.bottom.level)||!record.timing.bottom.active||record.timing.bottom.risk_active))return 'stale';
 if(record.state==='incomplete')return record.checked_session===expectedSignalTime(now)?'incomplete':'stale';
 if(record.state==='sell'&&!record.dependencies?.hourly&&record.checked_session!==expectedSignalTime(now))return 'stale';
 if(record.dependencies?.daily&&(!record.daily_as_of||record.daily_as_of!==expectedSignalTime(now,'daily')))return 'stale';
 if(record.dependencies?.hourly&&(!record.hourly_as_of||record.hourly_as_of!==expectedSignalTime(now)))return 'stale';return record.state;
}
export function signalCounts(stocks,records,now=new Date()){const counts={all:stocks.length,buy:0,sell:0,none:0,incomplete:0,pending:0,unscanned:0,stale:0};for(const s of stocks){const k=signalState(records[s.code],now);counts[k]++;if(k==='unscanned'||k==='stale')counts.pending++}return counts}
export function mergeSignals(old,incoming,codes){const out={...old};for(const [code,r] of Object.entries(incoming||{})){if(!r||typeof r!=='object'||!codes.has(code)||r.code!==code||r.rule!==SIGNAL_RULE||!['buy','sell','none','incomplete'].includes(r.state)||!Array.isArray(r.reasons)||!Number.isFinite(Date.parse(r.checked_at)))continue;if(!out[code]||out[code].rule!==SIGNAL_RULE||Date.parse(r.checked_at)>=Date.parse(out[code].checked_at))out[code]=r}return out}
