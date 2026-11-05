import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate} from '../core.mjs';
import {intervalAnalysis,intervalCSV} from '../intervals.mjs';
const draws=validate(JSON.parse(fs.readFileSync(new URL('../data/history.json',import.meta.url))));
test('interval statistics match the independently calculated historical report',()=>{
  const a=intervalAnalysis(draws);
  assert.deepEqual(a.map(s=>s.n),[216,219,269]);assert.deepEqual(a.map(s=>s.events),[217,220,270]);
  assert.deepEqual(a.map(s=>s.median),[13,11,9]);assert.deepEqual(a.map(s=>s.max),[87,133,69]);
  assert.deepEqual(a.map(s=>s.q95),[48,49,36]);assert.deepEqual(a.map(s=>s.current),[6,25,42]);
  [16.185185185185187,15.95890410958904,12.810408921933085].forEach((v,z)=>assert.ok(Math.abs(a[z].mean-v)<1e-12));
  assert.deepEqual(a[2].counts,[91,60,63,28,22,3,2]);
  for(const s of a){assert.equal(s.counts.reduce((a,b)=>a+b,0),s.n);assert.ok(Math.abs(s.rates.reduce((a,b)=>a+b,0)-100)<1e-10);}
});
test('event interval differs by one from the complete stretch between events',()=>{
  for(const s of intervalAnalysis(draws))for(const r of s.intervals){assert.equal(r.gap,r.between+1);assert.ok(r.from.issue<r.to.issue);}
  assert.equal(intervalAnalysis(draws)[1].intervals.find(r=>r.gap===133).from.issue,'2023126');
});
test('locked pre-2015 thresholds reproduce later observation counts',()=>{
  const a=intervalAnalysis(draws);
  assert.deepEqual(a.map(s=>s.validation.map(v=>[v.n,v.hits])),[[[55,7],[86,8]],[[102,7],[168,5]],[[60,8],[118,8]]]);
  const altered=draws.map(d=>d.date<'2015-01-01'?d:{...d,red:[1,2,3,4,5,6]});
  assert.deepEqual(intervalAnalysis(altered).map(s=>s.threshold),a.map(s=>s.threshold));
});
test('short histories without completed intervals remain unknown, not zero-average',()=>{
  const a=intervalAnalysis([{issue:'2026001',date:'2026-01-01',red:[1,2,3,4,5,6],blue:1}]);
  assert.equal(a[0].events,0);assert.equal(a[0].mean,null);assert.equal(a[0].current,null);assert.equal(a[0].threshold,null);
  assert.equal(a[1].events,1);assert.equal(a[1].n,0);assert.equal(a[1].current,0);assert.equal(a[1].mean,null);
});
test('full CSV exports all 704 intervals, dates and both complete six-red sets',()=>{
  const lines=intervalCSV(intervalAnalysis(draws)).split('\n');assert.equal(lines.length,705);
  assert.ok(lines.every(line=>line.split(',').length===9));
});
