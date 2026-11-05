import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate} from '../core.mjs';
import {absenceBlocks,referenceCSV} from '../references.mjs';
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
test('non-overlapping hundred-draw blocks preserve every record and overall counts',()=>{
  const b=absenceBlocks(draws);
  assert.equal(b.length,36);assert.equal(b.filter(v=>v.complete).length,35);
  assert.equal(b.reduce((s,v)=>s+v.n,0),3523);
  for(let i=1;i<b.length;i++)assert.equal(b[i].start,b[i-1].end+1);
  assert.deepEqual([0,1,2].map(z=>b.reduce((s,v)=>s+v.counts[z],0)),[217,220,270]);
  assert.equal(b[0].first.issue,'2003001');assert.equal(b[0].last.issue,'2004011');assert.deepEqual(b[0].rates,[6,8,5]);
});
test('partial last block has its actual denominator and remains distinct',()=>{
  const b=absenceBlocks(draws).at(-1);
  assert.equal(b.n,23);assert.equal(b.complete,false);assert.equal(b.first.issue,'2026104');assert.equal(b.last.issue,'2026126');
  assert.deepEqual(b.counts,[2,0,0]);assert.equal(b.rates[0],200/23);
  const fresh=absenceBlocks(draws.slice(0,200));assert.equal(fresh.length,2);assert.ok(fresh.every(v=>v.complete));
});
test('CSV includes interval IDs, dates, raw counts and denominator-qualified percentages',()=>{
  const lines=referenceCSV(absenceBlocks(draws)).split('\n');
  assert.equal(lines.length,37);assert.equal(lines[0].split(',').length,15);
  assert.equal(lines.at(-1).split(',')[3],'23');assert.equal(lines.at(-1).split(',')[4],'否');
  assert.equal(lines.at(-1).split(',')[10],'8.6957');
  assert.deepEqual(absenceBlocks([]),[]);assert.throws(()=>absenceBlocks(draws,0));
});
