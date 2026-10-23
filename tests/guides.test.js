import test from 'node:test';
import assert from 'node:assert/strict';
import {routes,filterRoutes,roadbook} from '../data.js';
import {getCityGuide,guideQuery,guideAliases,cityGuides} from '../recommendations.js';
test('every route stop has three sight, lodging and food entries with useful explanations',()=>{
 for(const r of routes)for(const s of r.stops){const g=getCityGuide(s);for(const group of ['sights','hotels','food']){assert.ok(g[group].length>=3,`${s.name}: ${group}`);assert.equal(new Set(g[group].map(i=>i.name)).size,g[group].length);for(const i of g[group]){assert.ok(i.reason.trim(),`${s.name}: missing reason for ${i.name}`);assert.ok(guideQuery(g,i).startsWith(g.location));}}}
});
test('lodging search directions never masquerade as named hotel recommendations',()=>{
 for(const g of Object.values(cityGuides))for(const h of g.hotels){assert.ok(['hotel','area'].includes(h.kind));assert.ok(h.kind==='area'?h.status.includes('非具体酒店'):h.status.includes('未核验'));}
 assert.ok(getCityGuide({name:'罗布泊镇'}).limited);assert.ok(getCityGuide({name:'米兰（若羌）'}).limited);
});
test('guide searches find route sights and hotel names, and exports include the guides',()=>{
 assert.ok(filterRoutes(routes,{query:'杜甫草堂'}).some(r=>r.id==='sichuan'));
 assert.ok(filterRoutes(routes,{query:'拉萨瑞吉'}).some(r=>r.id==='lhasa-gaize'));
 const r=routes.find(r=>r.id==='lopnur-loop');const text=roadbook(r);assert.ok(text.includes('楼兰博物馆'));assert.ok(text.includes('300—600'));assert.ok(text.includes('非具体酒店'));
 assert.equal(getCityGuide({name:'库尔勒（分段返程）'}),cityGuides[guideAliases['库尔勒（分段返程）']]);
 assert.ok(guideQuery(getCityGuide({name:'米兰（若羌）'}),{name:'抓饭'}).includes('新疆 若羌 米兰镇'));
});
