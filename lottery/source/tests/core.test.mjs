import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {validate,zoneStats,generate,absent,key,parseCSV} from '../core.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
test('historical snapshot and known zone statistics',()=>{
  assert.equal(draws.length,3523);assert.equal(draws.at(-1).issue,'2026126');
  const s=zoneStats(draws,2);assert.equal(s.events.length,270);assert.equal(s.current,42);assert.equal(s.max,69);assert.equal(s.trigger,true);
  assert.equal(s.events.at(-1).draw.issue,'2026084');
  assert.equal(s.mean,s.events.slice(1).reduce((a,e)=>a+e.gap,0)/269);
});
test('strict trigger and latest event reset, incomplete averages excluded',()=>{
  const a={red:[1,2,3,4,5,6]},b={red:[1,2,3,4,5,23]};
  let s=zoneStats([a,b,a,b,b,b,b],2);assert.equal(s.mean,2);assert.equal(s.current,4);assert.equal(s.trigger,false);
  s=zoneStats([a,b,a,b,b,b,b,b],2);assert.equal(s.trigger,true);
  assert.equal(zoneStats([a,b,a],2).current,0);assert.equal(zoneStats([b,b],2).trigger,false);
});
test('generation excludes selected zone, historical reds and duplicates; every group maps to 16 blues',()=>{
  const out=generate(draws,2,100),past=new Set(draws.map(d=>key(d.red)));
  assert.equal(out.length,100);assert.equal(new Set(out.map(key)).size,100);
  for(const red of out){assert.equal(new Set(red).size,6);assert.ok(red.every(n=>n>=1&&n<=22));assert.ok(!past.has(key(red)));assert.ok(absent({red},2));}
  assert.equal(out.flatMap(red=>Array.from({length:16},(_,i)=>[...red,i+1])).length,1600);
});
test('invalid counts and non-trigger zones rejected',()=>{
  for(const n of [0,1.5,101])assert.throws(()=>generate(draws,2,n));
  assert.throws(()=>generate(draws,-1,1));
  assert.throws(()=>generate(draws.slice(0,1),2,1));
});
test('CSV roundtrip and normalization',()=>{
  const d=draws[0],s=['issue,date,red1,red2,red3,red4,red5,red6,blue',[d.issue,d.date,...d.red,d.blue].join(',')].join('\n');
  assert.deepEqual(parseCSV(s),[d]);assert.equal(validate([{...d,issue:'03001',blue:[d.blue]}])[0].issue,'2003001');
});
test('malformed imports fail without accepting duplicate or invalid records',()=>{
  const d=draws[0];
  assert.throws(()=>validate([d,d]));assert.throws(()=>validate([{...d,red:[1,1,2,3,4,5]}]));
  assert.throws(()=>validate([{...d,blue:17}]));assert.throws(()=>validate([{...d,date:'2003-02-30'}]));
  assert.throws(()=>validate([{...d,issue:'<script>'}]));assert.throws(()=>parseCSV('bad,data'));
});
