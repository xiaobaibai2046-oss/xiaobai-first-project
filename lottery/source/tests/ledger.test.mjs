import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {validate,generate} from '../core.mjs';
import {randomControl,makeRecord,validateRecord,mergeRecords,settleGroups,assessRecord} from '../ledger.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
const options=()=>({draws,groups:generate(draws,2,3),zone:2,target:'2026127',cutoff:'2026-11-05T20:00:00+08:00',now:'2026-11-04T00:00:00Z'});
test('record captures source, locked controls and identical costs; separate original groups',()=>{
  const o=options(),r=makeRecord(o);assert.equal(r.cost,96);assert.equal(r.control.length,3);assert.equal(r.source.issue,'2026126');assert.equal(r.rule.current,42);assert.equal(r.targetDate,'2026-11-05');
  assert.deepEqual(validateRecord(r),r);o.groups[0][0]=99;assert.ok(!r.groups[0].includes(99));
  assert.equal(new Set(randomControl(100).map(r=>r.join(','))).size,100);
});
test('prohibit retrospective, duplicate and invalid date records',()=>{
  assert.throws(()=>makeRecord({...options(),target:'2026126'}));
  assert.throws(()=>makeRecord({...options(),now:'2026-11-05T13:00:00Z'}));
  const r=makeRecord(options());assert.throws(()=>makeRecord({...options(),records:[r]}));
  assert.throws(()=>makeRecord({...options(),target:'2027127'}));
  assert.throws(()=>makeRecord({...options(),groups:[[23,24,25,26,27,28]]}));
});
test('all 16 blue tickets settle at real conventional prize tiers',()=>{
  const d={red:[1,2,3,4,5,6],blue:1};
  for(const [red,levels,payout,unknown] of [
    [[1,2,3,4,5,6],[1,15,0,0,0,0],0,true],
    [[1,2,3,4,5,7],[0,0,1,15,0,0],6000,false],
    [[1,2,3,4,7,8],[0,0,0,1,15,0],350,false],
    [[1,2,3,7,8,9],[0,0,0,0,1,0],10,false],
    [[1,2,7,8,9,10],[0,0,0,0,0,1],5,false],
    [[7,8,9,10,11,12],[0,0,0,0,0,1],5,false],
  ]){const s=settleGroups([red],d);assert.deepEqual(s.levels,levels);assert.equal(s.knownPayout,payout);assert.equal(s.unknownPayout,unknown);assert.equal(s.cost,32);}
});
test('pending stays pending; recorded results survive missing data; conflicts not overwritten',()=>{
  const r=makeRecord(options());assert.equal(assessRecord(r,draws).status,'pending');
  const d={issue:r.target,date:r.targetDate,red:[1,2,3,4,5,6],blue:1};
  assert.equal(assessRecord(r,[...draws,d]).status,'settled');
  const saved={...r,resultDraw:d};assert.equal(assessRecord(saved,draws).status,'settled');
  assert.equal(assessRecord(saved,[{...d,blue:2}]).status,'conflict');
  assert.equal(assessRecord(r,[{...d,date:'2026-11-06'}]).status,'conflict');
});
test('backup merge skips exact duplicates and rejects conflicts atomically',()=>{
  const r=makeRecord(options());assert.equal(mergeRecords([r],[r]).length,1);
  assert.throws(()=>mergeRecords([r],[{...r,mode:'purchased'}]));
  assert.throws(()=>mergeRecords([r],[{...r,id:webcrypto.randomUUID()}]));
  assert.throws(()=>validateRecord({...r,cost:2}));
  assert.throws(()=>validateRecord({...r,savedAt:r.cutoff}));
  assert.throws(()=>validateRecord({...r,control:[]}));
  assert.equal(r.mode,'simulation');
});
