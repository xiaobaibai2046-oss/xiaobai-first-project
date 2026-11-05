import {test} from 'node:test';import assert from 'node:assert/strict';
import {expectedSignalTime,signalState,signalRecord,signalCounts,mergeSignals,SIGNAL_RULE} from './signal-model.js';import {scanStock,createSignalScanner} from './signal-scan.js';
const now=new Date('2026-10-27T08:10:00Z');
function data(code='600001',kind='bottom',below=false){
 const knots=kind==='top'?[[0,100],[60,100],[80,80],[90,90],[110,79],[116,87]]:[[0,100],[20,105],[40,105],[65,60],[80,90],[116,59]],scale=12/(kind==='top'?213:59);
 const hourly={code,source:'TEST hourly',bars:Array.from({length:117},(_,i)=>{let k=1;while(knots[k][0]<i)k++;const [a,x]=knots[k-1],[z,y]=knots[k];let close=x+(y-x)*(i-a)/(z-a);if(kind==='top')close=300-close;close*=scale;const slot=i+3,date=new Date(Date.UTC(2026,9,27+Math.floor(slot/4)-29)).toISOString().slice(0,10);return {code,endTime:date+'T'+['10:30','11:30','14:00','15:00'][slot%4]+':00+08:00',open:close,close,high:close+.01,low:close-.01,volume:kind==='bottom'&&i===116?400:1000}})};
 const bars=Array.from({length:80},(_,i)=>{const close=10+i*.025;return {code,name:'测试样本',date:new Date(Date.UTC(2026,9,27-79+i)).toISOString().slice(0,10),open:close,close,high:close+.1,low:close-.1,volume:1000}});if(below)Object.assign(bars.at(-1),{open:8,close:8,high:8.1,low:7.9});
 return {history:{code,name:'测试样本',source:'TEST daily',bars},hourly,quote:{quotes:[{code,name:'测试样本',price:12,exchange_time:'2026-10-27T15:00:00+08:00'}]},financial:{code,source:'TEST report',reports:[{period:'2026-06-30',notice_date:'2026-08-15',profit:100,revenue:1000,revenue_yoy:10,profit_yoy:10,eps:1,ocf_per_share:1,industry:'制造'}]}};
}
test('freshness uses completed Shanghai sessions, previous weekdays and weekend close',()=>{assert.equal(expectedSignalTime(new Date('2026-10-26T01:00:00Z')),'2026-10-23T15:00:00+08:00');assert.equal(expectedSignalTime(new Date('2026-10-27T03:45:00Z')),'2026-10-27T11:30:00+08:00');assert.equal(expectedSignalTime(new Date('2026-10-27T07:45:00Z'),'daily'),'2026-10-27');assert.equal(expectedSignalTime(now,'daily'),'2026-10-27');assert.equal(expectedSignalTime(new Date('2026-10-31T08:00:00Z')),'2026-10-30T15:00:00+08:00')});
test('hourly-only buy scan needs no daily, quote or financial requests',async()=>{
 const inputs=data(),calls=[];const r=await scanStock('600001',async k=>{calls.push(k);return inputs[k]},()=>now);
 assert.equal(r.state,'buy');assert.ok(r.timing.bottom.confirmed_at);assert.equal(r.dependencies.daily,false);assert.equal(r.dependencies.hourly,true);assert.equal(signalState(r,now),'buy');assert.deepEqual(calls,['hourly']);
 const below=data('600001','bottom',true);below.financial.reports[0].profit=-1;
 const summary=(await import('./conclusion.js')).summarizeStock({code:'600001',...below,quote:below.quote.quotes[0],now,includeSimulation:false});
 assert.equal(summary.tradeHints.buy.triggered,true);assert.equal(summary.tradeHints.sell.triggered,true);const both=signalRecord(summary,now);assert.equal(both.state,'buy');assert.equal(both.signals.sell,true);
});
test('sell rules still use MA20 or top divergence after checking the hourly buy first',async()=>{
 const inputs=data('600001','top');let calls=[];const top=await scanStock('600001',async k=>{calls.push(k);return inputs[k]},()=>now);
 assert.equal(top.state,'sell');assert.deepEqual(calls,['hourly']);
 calls=[];const missingHourly=data('600001','bottom',true);const day=await scanStock('600001',async k=>{calls.push(k);if(k==='hourly')throw Error('没有 m60 K线');return missingHourly[k]},()=>now);
 assert.equal(day.state,'sell');assert.equal(day.dependencies.daily,true);assert.deepEqual(calls,['hourly','history']);
 assert.equal(signalState(day,new Date('2026-10-28T02:31:00Z')),'stale');
});
test('missing hourly stays incomplete while missing all other sources cannot block a valid bottom',async()=>{
 const failure=await scanStock('600001',async()=>{throw Error('TEST outage')},()=>now);assert.equal(failure.state,'incomplete');
 const inputs=data();const onlyHour=await scanStock('600001',async k=>{if(k!=='hourly')throw Error('TEST unavailable');return inputs[k]},()=>now);
 assert.equal(onlyHour.state,'buy');assert.equal(signalState(null,now),'unscanned');
});
test('new closed bar/day makes prior classifications stale instead of retaining a red/green marker',async()=>{const inputs=data();const r=await scanStock('600001',async k=>inputs[k],()=>now);assert.equal(signalState(r,new Date('2026-10-28T02:31:00Z')),'stale');assert.equal(signalState({...r,rule:'old'},now),'stale');assert.equal(signalState({...r,dependencies:{}},now),'stale');const count=signalCounts([{code:'600001'},{code:'600002'}],{'600001':r},now);assert.equal(count.buy,1);assert.equal(count.unscanned,1);assert.equal(count.pending,1);assert.equal(count.none,0)});
test('newer individual analysis replaces the same pool record, outsiders and old versions are ignored',async()=>{const r=await scanStock('600001',async k=>data()[k],()=>now);const old={...r,checked_at:'2026-10-26T08:10:00Z'};const merged=mergeSignals({'600001':old},{'600001':r,'600002':{...r,code:'600002'}},new Set(['600001']));assert.equal(merged['600001'].checked_at,r.checked_at);assert.equal(merged['600002'],undefined);assert.equal(mergeSignals({}, {'600001':{...r,rule:'old'}},new Set(['600001']))['600001'],undefined)});
test('pause finishes the current stock, resume skips fresh results and completes remaining entries',async()=>{const records={},stocks=[{code:'600001'},{code:'600002'},{code:'600003'}];let first=true,scanner;scanner=createSignalScanner({stocks:()=>stocks,records:()=>records,request:async(kind,code)=>{if(first){first=false;scanner.pause()}return data(code,'bottom',true)[kind]},onResult:r=>{records[r.code]=r},onProgress:()=>{},delay:0,concurrency:1,now:()=>now});await scanner.start();assert.equal(Object.keys(records).length,1);await scanner.start();assert.equal(Object.keys(records).length,3);assert.equal(scanner.isRunning(),false)});
test('consecutive source failure stops batch scanning without labelling untouched stocks neutral',async()=>{const records={},stocks=Array.from({length:10},(_,i)=>({code:String(600001+i)}));const scanner=createSignalScanner({stocks:()=>stocks,records:()=>records,request:async()=>{throw Error('TEST denied')},onResult:r=>{records[r.code]=r},onProgress:()=>{},delay:0,concurrency:1,now:()=>now});await scanner.start();assert.equal(Object.keys(records).length,6);const count=signalCounts(stocks,records,now);assert.equal(count.incomplete,6);assert.equal(count.unscanned,4);assert.equal(count.none,0)});

test('per-stock missing coverage does not falsely trip the global network outage circuit',async()=>{const records={},stocks=Array.from({length:8},(_,i)=>({code:String(600001+i)}));const scanner=createSignalScanner({stocks:()=>stocks,records:()=>records,request:async kind=>{throw Error(kind==='history'?'没有已完成的日线':'数据源没有返回m60K线')},onResult:r=>{records[r.code]=r},onProgress:()=>{},delay:0,concurrency:1,now:()=>now});await scanner.start();assert.equal(Object.keys(records).length,8);assert.equal(mergeSignals({}, {'600001':null},new Set(['600001']))['600001'],undefined)});
test('MACD-only buys survive missing daily data but expire at the next completed hour',async()=>{
 const r=await scanStock('600001',async k=>data()[k],()=>now);
 assert.equal(r.daily_as_of,null);assert.equal(signalState(r,now),'buy');
 assert.equal(signalState({...r,daily_as_of:'2000-01-01'},now),'buy');
 assert.equal(signalState(r,new Date('2026-10-28T02:31:00Z')),'stale');
});
test('previous rule caches are stale and cannot override a fresh new-rule result',async()=>{
 const r=await scanStock('600001',async k=>data()[k],()=>now),old={...r,rule:'ma20-m60-dif-v2-bottom-tol-3000',checked_at:'2099-01-01T00:00:00Z'};
 assert.equal(signalState(old,now),'stale');assert.equal(mergeSignals({'600001':old},{'600001':r},new Set(['600001']))['600001'].rule,SIGNAL_RULE);
});
test('a stale public hourly series never becomes a current bottom-divergence buy',async()=>{
 const {summarizeStock}=await import('./conclusion.js'),inputs=data();
 const summary=summarizeStock({code:'600001',hourly:inputs.hourly,now:new Date('2026-10-28T03:45:00Z'),includeSimulation:false});
 assert.ok(summary.macd.bullish.active);assert.equal(summary.tradeHints.buy.triggered,false);
});
test('source migration can force a fresh cached record through the scanner without changing strategy',async()=>{
 const records={'600001':{code:'600001',rule:SIGNAL_RULE,state:'none',checked_at:now.toISOString(),checked_session:expectedSignalTime(now),daily_as_of:expectedSignalTime(now,'daily'),hourly_as_of:expectedSignalTime(now),dependencies:{daily:true,hourly:true},reasons:[]}},calls=[];
 const scanner=createSignalScanner({stocks:()=>[{code:'600001'}],records:()=>records,request:async k=>{calls.push(k);return data()[k]},onResult:r=>{records[r.code]=r},onProgress:()=>{},delay:0,now:()=>now});
 await scanner.start();assert.equal(calls.length,0);
 await scanner.start({force:true});assert.equal(records['600001'].state,'buy');assert.deepEqual(calls,['hourly']);
});
test('cached buys require a current strict wave event with first or second level',async()=>{
 const r=await scanStock('600001',async k=>data()[k],()=>now);assert.equal(signalState(r,now),'buy');
 for(const bottom of [null,{...r.timing.bottom,mode:'pivot'},{...r.timing.bottom,level:3},{...r.timing.bottom,active:false}])assert.equal(signalState({...r,timing:{...r.timing,bottom}},now),'stale');
});
