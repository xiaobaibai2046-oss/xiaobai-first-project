import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {validate,key} from '../core.mjs';
import {planStats,drawBlues,generateCoverage,blueModeOf} from '../bets.mjs';
import {makeRecord,validateRecord,mergeRecords,settleGroups,assessRecord} from '../ledger.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
const timing={zone:2,target:'2026127',cutoff:'2026-11-05T20:00:00+08:00',now:'2026-11-04T00:00:00Z'};
test('72 single-blue tickets cost 144 with separate first and first-or-second conditional probabilities',()=>{
  const s=planStats(72,'single');assert.equal(s.cost,144);assert.equal(s.tickets,72);
  assert.equal(s.conditionalTopTwo,72/74613);assert.equal(s.conditionalFirst,72/1193808);
  assert.equal(s.overallTopTwo,72/1107568);assert.equal(s.overallFirst,72/17721088);
  assert.ok(Math.abs(s.conditionalTopTwo/(57/74613)-1-15/57)<1e-12);
  const old=planStats(1,'all');assert.equal(old.cost,32);assert.equal(old.conditionalFirst,old.conditionalTopTwo);
});
test('coverage generation can include previous six-red results when historical filtering is off',()=>{
  const d=draws.map((r,i)=>i===0?{...r,red:[1,2,3,4,5,6]}:r);
  assert.deepEqual(generateCoverage(d,2,1,{excludeHistory:false},()=>0),[[1,2,3,4,5,6]]);
  const g=generateCoverage(d,2,72);assert.equal(g.length,72);assert.equal(new Set(g.map(key)).size,72);assert.ok(g.every(r=>r.every(n=>n<=22)));
  const past=new Set(d.map(r=>key(r.red)));
  assert.ok(generateCoverage(d,2,20,{excludeHistory:true}).every(r=>!past.has(key(r))));
});
test('single-blue records preserve strategy and control blues and reject invalid costs or missing blues',()=>{
  const groups=generateCoverage(draws,2,72),blues=drawBlues(72);
  const r=makeRecord({draws,groups,blues,blueMode:'single',excludeHistory:false,...timing});
  assert.equal(r.version,2);assert.equal(r.cost,144);assert.equal(r.control.length,72);assert.equal(r.controlBlues.length,72);assert.equal(blueModeOf(r),'single');assert.deepEqual(validateRecord(r),r);
  blues[0]=99;assert.ok(r.blues[0]<=16);
  assert.throws(()=>validateRecord({...r,blues:[]}));assert.throws(()=>validateRecord({...r,controlBlues:[]}));assert.throws(()=>validateRecord({...r,cost:2304}));
  assert.deepEqual(mergeRecords([],JSON.parse(JSON.stringify([r]))),[r]);
});
test('every single ticket is settled against its actual assigned blue, including first vs second',()=>{
  const draw={red:[1,2,3,4,5,6],blue:1};
  const cases=[
    [[1,2,3,4,5,6],1,[1,0,0,0,0,0],0,true],
    [[1,2,3,4,5,6],2,[0,1,0,0,0,0],0,true],
    [[1,2,3,4,5,7],1,[0,0,1,0,0,0],3000,false],
    [[1,2,3,4,5,7],2,[0,0,0,1,0,0],200,false],
    [[1,2,3,4,7,8],1,[0,0,0,1,0,0],200,false],
    [[1,2,3,4,7,8],2,[0,0,0,0,1,0],10,false],
    [[1,2,3,7,8,9],1,[0,0,0,0,1,0],10,false],
    [[1,2,3,7,8,9],2,[0,0,0,0,0,0],0,false],
    [[1,2,7,8,9,10],1,[0,0,0,0,0,1],5,false],
  ];
  for(const [red,blue,levels,payout,unknown]of cases){const s=settleGroups([red],draw,'single',[blue]);assert.deepEqual(s.levels,levels);assert.equal(s.cost,2);assert.equal(s.knownPayout,payout);assert.equal(s.unknownPayout,unknown);assert.equal(s.topTwo,levels[0]+levels[1]);}
});
test('legacy version-1 full-blue backup retains original cost, 16-ticket awards and exact bytes',()=>{
  const r=makeRecord({draws,groups:generateCoverage(draws,2,1),excludeHistory:false,...timing});
  r.version=1;delete r.blueMode;delete r.blues;delete r.controlBlues;delete r.rule.excludeHistory;
  const bytes=JSON.stringify(r);assert.equal(blueModeOf(validateRecord(r)),'all');assert.equal(r.cost,32);
  const d={issue:r.target,date:r.targetDate,red:r.groups[0],blue:1};const result=assessRecord(r,[d]);
  assert.equal(result.strategy.first,1);assert.equal(result.strategy.second,15);assert.equal(result.strategy.topTwo,16);assert.equal(result.strategy.sixRedGroups,1);
  assert.equal(JSON.stringify(r),bytes);assert.deepEqual(mergeRecords([],[r]),[r]);
});
