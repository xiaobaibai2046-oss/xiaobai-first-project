import test from 'node:test';
import assert from 'node:assert/strict';
import {routes,filterRoutes,mapUrl,roadbook} from '../data.js';
test('region, duration, city, food, favorites and empty searches',()=>{
assert.deepEqual(filterRoutes(routes,{region:'西藏'}).map(r=>r.id),['sichuan','lhasa-gaize','gaize-minfeng']);
assert.deepEqual(filterRoutes(routes,{duration:'short'}).map(r=>r.id),['ili','lhasa-gaize','minfeng-luntai','qiemo-tazhong','yunnan-southeast','qinghai-lake','qinghai-south','gansu-southeast']);
assert.equal(filterRoutes(routes,{query:'喀什'})[0].id,'south');
assert.equal(filterRoutes(routes,{query:'石锅鸡'})[0].id,'sichuan');
assert.equal(filterRoutes(routes,{savedOnly:true,saved:[]}).length,0);
assert.deepEqual(filterRoutes(routes,{savedOnly:true,saved:['ili']}).map(r=>r.id),['ili']);
assert.equal(filterRoutes(routes,{region:'西藏',query:'喀什'}).length,0);
assert.equal(filterRoutes(routes,{query:'不存在的路线'}).length,0);
});
test('map search keeps Chinese and special characters inside keyword',()=>{const query='拉萨 酒店 & 美食';const url=new URL(mapUrl(query));assert.equal(url.protocol,'https:');assert.equal(url.hostname,'uri.amap.com');assert.equal(url.searchParams.get('keyword'),query);});
test('export includes every stop, driving guidance and booking query',()=>{for(const route of routes){const text=roadbook(route);for(const stop of route.stops){assert.ok(text.includes(stop.name));assert.ok(text.includes(stop.drive));assert.ok(text.includes(mapUrl(stop.name+' '+stop.area)));}assert.ok(text.includes('出行前核实'));}});

test('cross-region route is searchable from both regions and unknown duration is not classified',()=>{const route=routes.find(r=>r.id==='gaize-minfeng');for(const region of ['西藏','新疆'])assert.ok(filterRoutes(routes,{region,query:'民丰'}).includes(route));for(const duration of ['short','long'])assert.ok(!filterRoutes(routes,{duration}).includes(route));const text=roadbook(route);assert.ok(text.includes('天数待核实'));assert.ok(text.includes('818 公里'));assert.ok(text.includes('用户提供'));assert.ok(!text.includes('null'));});

test('Lop Nur loop preserves requested stop order and exports unresolved access requirements',()=>{const r=routes.find(r=>r.id==='lopnur-loop');assert.deepEqual(r.stops.map(s=>s.name),['乌鲁木齐','哈密','罗布泊镇','米兰（若羌）','若羌','且末','塔中','库尔勒','乌鲁木齐']);assert.ok(filterRoutes(routes,{region:'新疆',query:'罗布泊'}).includes(r));assert.equal(r.days,null);assert.equal(r.distance,2668);assert.ok(roadbook(r).includes('未获明确许可'));});

test('Qinghai retains its loops and includes the new cross-province route',()=>{const items=filterRoutes(routes,{region:'青海'});assert.equal(items.length,4);for(const r of items){assert.equal(r.stops[0].name,r.stops.at(-1).name);assert.ok(roadbook(r).includes('高原'));}assert.ok(filterRoutes(routes,{region:'甘肃'}).some(r=>r.id==='qinghai-gansu'));});

test('Gansu filter includes three Lanzhou loops and the existing Qinghai-Gansu loop',()=>{const items=filterRoutes(routes,{region:'甘肃'});assert.equal(items.length,4);for(const id of ['gansu-hexi','gansu-gannan','gansu-southeast']){const r=items.find(r=>r.id===id);assert.equal(r.stops[0].name,'兰州');assert.equal(r.stops.at(-1).name,'兰州');}assert.ok(items.some(r=>r.id==='qinghai-gansu'));});
