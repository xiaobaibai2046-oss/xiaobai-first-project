import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runScanCycles} from './scripts/scan-cycles.mjs';
import {SIGNAL_RULE,expectedSignalTime,signalCounts} from './signal-model.js';
import {planSignalBatch} from './scan-plan.js';
function record(code,time,dailyOnly=false){return {code,rule:SIGNAL_RULE,state:dailyOnly?'sell':'none',checked_at:time.toISOString(),checked_session:expectedSignalTime(time),daily_as_of:expectedSignalTime(time,'daily'),hourly_as_of:expectedSignalTime(time),dependencies:{daily:true,hourly:!dailyOnly},reasons:[]}}
test('scan crossing the market close replans both skipped daily sells and records just scanned',async()=>{
 let clock=new Date('2026-11-02T06:59:00Z');const old=new Date('2026-10-30T08:10:00Z');
 const stocks=[{code:'600001'},{code:'600002'}],records={'600001':record('600001',old,true),'600002':record('600002',old)};
 const batches=[];
 const passes=await runScanCycles({now:()=>clock,deadline:Date.parse('2026-11-02T07:05:00Z'),plan:now=>planSignalBatch(stocks,records,{now}),scan:async candidates=>{
  batches.push(candidates.map(s=>s.code));for(const s of candidates)records[s.code]=record(s.code,clock);
  if(batches.length===1)clock=new Date('2026-11-02T07:00:01Z');
  return {status:'batch_complete',codes:candidates.map(s=>s.code)};
 }});
 assert.equal(passes,2);assert.deepEqual(batches,[['600002'],['600001','600002']]);assert.equal(signalCounts(stocks,records,clock).pending,0);
});
test('one failing stock is not retried indefinitely within the same session',async()=>{
 let calls=0;const code='600001';
 const passes=await runScanCycles({now:()=>new Date('2026-11-02T08:10:00Z'),deadline:Date.parse('2026-11-02T08:20:00Z'),plan:()=>[{code}],scan:async()=>{calls++;return {codes:[code],status:'batch_complete'}}});
 assert.equal(passes,1);assert.equal(calls,1);
});
test('deadline stops without beginning another batch',async()=>{
 let calls=0;await runScanCycles({now:()=>new Date(1000),deadline:1000,plan:()=>[{code:'600001'}],scan:()=>{calls++}});assert.equal(calls,0);
});
test('network backoff is bounded and does not hammer the source',async()=>{
 let n=0,clock=Date.parse('2026-11-02T08:10:00Z');const delays=[];
 const passes=await runScanCycles({now:()=>new Date(clock),deadline:clock+600000,plan:()=>[{code:String(600000+n)}],scan:async candidates=>{n++;return {codes:candidates.map(s=>s.code),status:'source_unavailable'}},wait:async ms=>{delays.push(ms);clock+=ms}});
 assert.equal(passes,4);assert.deepEqual(delays,[30000,60000,120000]);
});
