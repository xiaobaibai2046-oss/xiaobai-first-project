import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {key,validate} from '../core.mjs';
import {fixedCandidates,fixedStats,generateFixed} from '../fixed.mjs';
import {makeRecord,validateRecord,assessRecord} from '../ledger.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
const timing={zone:2,target:'2026127',cutoff:'2026-11-05T20:00:00+08:00',now:'2026-11-04T00:00:00Z'};
function record(){const p=generateFixed();return makeRecord({...timing,draws:[draws.at(-1)],groups:p.groups,blues:p.blues,blueMode:'single',excludeHistory:false,scheme:'fixed-triple'});}
test('exactly 969 distinct candidates cover all remaining triples and do not exclude longer runs',()=>{
  const a=fixedCandidates();assert.equal(a.length,969);assert.equal(new Set(a.map(key)).size,969);
  assert.ok(a.every(r=>r.length===6&&new Set(r).size===6&&r.every(n=>n<=22)&&[10,11,12].every(n=>r.includes(n))));
  assert.ok(a.some(r=>key(r)==='1,10,11,12,13,14'));
});
test('97 single-blue groups cost 194 with 97/969 combined and 97/15504 first-prize conditional chances',()=>{
  const p=generateFixed();assert.equal(p.groups.length,97);assert.equal(new Set(p.groups.map(key)).size,97);assert.equal(p.blues.length,97);assert.ok(p.blues.every(n=>n>=1&&n<=16));
  assert.equal(p.stats.cost,194);assert.equal(p.stats.conditionalTopTwo,97/969);assert.equal(p.stats.conditionalFirst,97/15504);
  assert.ok(fixedStats(96).conditionalTopTwo<.1);assert.ok(fixedStats(97).conditionalTopTwo>=.1);
  assert.throws(()=>generateFixed(0));assert.throws(()=>generateFixed(101));
});
test('hypothesis records are valid without a historical omission trigger and retain identity',()=>{
  const r=record();assert.equal(r.rule.name,'fixed-triple-hypothesis-v1');assert.equal(r.cost,194);assert.deepEqual(r.rule.fixed,[10,11,12]);assert.deepEqual(validateRecord(r),r);
  assert.throws(()=>makeRecord({...timing,draws:[draws.at(-1)],groups:r.groups,blues:r.blues,blueMode:'single',excludeHistory:false}));
  assert.throws(()=>validateRecord({...r,groups:r.groups.map((g,i)=>i===0?[1,2,3,4,5,6]:g)}));
  assert.throws(()=>validateRecord({...r,rule:{...r.rule,conditionalUniverse:74613}}));
  assert.throws(()=>validateRecord({...r,blueMode:'all',blues:[],controlBlues:[],cost:97*32}));
});
test('settlement distinguishes full hypothesis, missing fixed triple and third-zone appearance',()=>{
  const r=record(),base={issue:r.target,date:r.targetDate,blue:r.blues[0]%16+1};
  const hit=assessRecord(r,[{...base,red:r.groups[0]}]);assert.equal(hit.conditionMet,true);assert.equal(hit.strategy.second,1);assert.equal(hit.strategy.first,0);
  const noTriple=assessRecord(r,[{...base,red:[1,2,3,4,5,6]}]);assert.equal(noTriple.conditionMet,false);assert.equal(noTriple.strategy.topTwo,0);
  const thirdZone=assessRecord(r,[{...base,red:[10,11,12,23,24,25]}]);assert.equal(thirdZone.conditionMet,false);assert.equal(thirdZone.strategy.topTwo,0);assert.equal(thirdZone.strategy.cost,194);
});
