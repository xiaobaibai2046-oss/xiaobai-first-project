import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {validate,key} from '../core.mjs';
import {conditionPools,generateStructured,checkSelection} from '../conditions.mjs';
import {makeRecord,validateRecord} from '../ledger.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
test('two-zone history excludes exactly the triples seen in eligible draws',()=>{
  const s=conditionPools(draws,2);
  assert.equal(s.runScope,'zoneHistory');assert.equal(s.runDrawCount,270);assert.deepEqual(s.runs,[[10,11,12]]);assert.equal(s.excludedRuns.length,19);
  for(const e of s.excludedRuns){assert.ok(e.triple.every(n=>e.first.red.includes(n)));assert.ok(e.last.red.every(n=>n<=22));assert.ok(e.count>0);}
  assert.throws(()=>generateStructured(draws,2,1,{runScope:'all'}),/仅有0组/);
});
test('hot and cold pools use only last 50 draws and exclude the selected zone',()=>{
  const s=conditionPools(draws,2,{runScope:'recent50'});
  assert.deepEqual(s.hot,[4,14,22,5,6,11]);assert.deepEqual(s.cold,[8,3,21,19,17,9]);
  assert.equal(s.windowEnd,'2026126');assert.equal(new Set([...s.hot,...s.cold]).size,12);
  const mutated=draws.map((d,i)=>i<draws.length-50?{...d,red:[1,2,3,4,5,6]}:d);
  assert.deepEqual(conditionPools(mutated,2,{runScope:'recent50'}).frequency,s.frequency);
});
test('generated groups meet all roles, exact one triple, exclusions and uniqueness',()=>{
  const result=generateStructured(draws,2,100,{runScope:'recent50',exactRun:true});
  assert.equal(result.groups.length,100);assert.equal(new Set(result.groups.map(key)).size,100);
  const past=new Set(draws.map(d=>key(d.red)));
  result.groups.forEach((g,i)=>{
    assert.ok(g.every(n=>n<=22));assert.ok(!past.has(key(g)));assert.equal(new Set(g).size,6);
    const v=result.selection.roles[i];assert.equal(key([...v.hot,v.cold,...v.triple,v.random]),key(g));
    assert.ok(v.hot.every(n=>result.selection.hot.includes(n)));assert.ok(result.selection.cold.includes(v.cold));
    assert.equal(g.slice(1).filter((n,j)=>n===g[j]+1).length,2);
    assert.ok(!draws.slice(-50).some(d=>v.triple.every(n=>d.red.includes(n))));
  });
  checkSelection(result.groups,result.selection,2);
});
test('insufficient history and impossible count fail, generation does not refill from unrelated groups',()=>{
  assert.throws(()=>conditionPools(draws.slice(-49),2),/至少需要50期/);
  assert.throws(()=>generateStructured(draws,2,101,{runScope:'recent50'}));
  assert.throws(()=>conditionPools(draws,2,{runScope:'unknown'}));
});
test('structured rule snapshot survives ledger validation and changed roles are rejected',()=>{
  const {groups,selection}=generateStructured(draws,2,3,{runScope:'recent50'});
  const record=makeRecord({draws,groups,selection,zone:2,target:'2026127',cutoff:'2026-11-05T20:00:00+08:00',now:'2026-11-04T00:00:00Z'});
  assert.deepEqual(validateRecord(record).selection,selection);
  const bad=structuredClone(record);bad.selection.roles[0].random=33;assert.throws(()=>validateRecord(bad));
  const original=record.selection.hot[0];selection.hot[0]=33;assert.equal(record.selection.hot[0],original);
});
