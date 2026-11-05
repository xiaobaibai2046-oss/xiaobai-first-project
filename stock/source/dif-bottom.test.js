import {test} from 'node:test';import assert from 'node:assert/strict';
import {findTrueDifBottoms} from './dif-bottom.js';
function fixture(){
 const lows=[200,200,200,100,90,95,110,110,85,80,82,100,100,75,70,90,90,65,90,60];
 const dif=[0,1,1,-5,-6,-5,-3,-1,-4,-5,-4,-2,-1,-3,-4,-2,-1,-2,-1,-1];
 const h=[0,1,1,-4,-5,-3,1,1,-2,-3,-1,1,1,-1,-2,1,1,-.5,1,-.2];
 return {bars:lows.map((low,i)=>({endTime:new Date(Date.UTC(2026,0,1,i)).toISOString(),open:low+2,close:low+2,high:low+3,low,volume:i>=17?20:i>=13?50:i>=8?80:100})),series:dif.map((dif,i)=>({dif,dea:dif-h[i]/2,histogram:h[i]}))};
}
const options={stageBars:5,minBars:0};
const at=(data,n)=>findTrueDifBottoms(data.bars.slice(0,n+1),data.series.slice(0,n+1),options);
test('true DIF uses completed waves, shrinkage and volume; counts once/twice/third-plus by waves',()=>{
 const d=fixture();assert.equal(at(d,9).bullish.level,1);assert.equal(at(d,9).bullish.active,true);
 assert.equal(at(d,13).bullish.level,2);assert.equal(at(d,14).bullish.level,2);
 assert.equal(at(d,17).bullish.level,3);assert.equal(at(d,17).bullish.active,false);assert.equal(at(d,17).bullish.riskActive,true);
 assert.equal(at(d,19).bullish.level,3);assert.equal(at(d,19).bullish.sequence,4);
});
test('green histogram shortening alone cannot pass while corresponding DIF makes a lower low',()=>{
 const d=fixture();d.series[9].dif=-7;assert.equal(at(d,9).bullish?.active||false,false);
});
test('a higher DIF at the price low cannot hide an earlier lower minimum DIF in the same wave',()=>{
 const d=fixture();d.series[8].dif=-7;assert.equal(at(d,9).bullish?.active||false,false);
});
test('green peak must be strictly smaller and price must be a strict new low without tolerance',()=>{
 let d=fixture();d.series[9].histogram=-6;assert.equal(at(d,9).bullish?.active||false,false);
 for(const price of [90,90.1]){d=fixture();d.bars[9].low=price;assert.equal(at(d,9).bullish?.active||false,false)}
 d=fixture();d.bars[1].low=75;assert.equal(findTrueDifBottoms(d.bars.slice(0,10),d.series.slice(0,10),{stageBars:60,minBars:0}).bullish?.active||false,false);
});
test('new-low volume must be less than prior low plus previous two bars mean',()=>{
 for(const volume of [100,110]){const d=fixture();d.bars[9].volume=volume;assert.equal(at(d,9).bullish?.active||false,false)}
 const d=fixture();d.bars[2].volume=20;d.bars[3].volume=20;d.bars[4].volume=200;d.bars[9].volume=100;
 assert.equal(at(d,9).bullish?.active||false,false);
});
test('failed completed-wave conditions reset consecutive counts',()=>{
 const d=fixture();d.bars[9].volume=120;assert.equal(at(d,13).bullish.level,1);
});
test('signal occurs at the new-low close, never extends eight bars or uses future bars',()=>{
 const d=fixture(),prefix=at(d,9);assert.equal(prefix.bullish.confirmedIndex,9);assert.equal(prefix.bullish.secondIndex,9);
 assert.equal(at(d,10).bullish.active,false);
 const later=at(d,19).events.find(e=>e.secondIndex===9);assert.equal(later.confirmedAt,prefix.bullish.confirmedAt);assert.equal(later.level,1);
 assert.equal(findTrueDifBottoms(d.bars.slice(0,10),d.series.slice(0,10)).bullish,null);
});
