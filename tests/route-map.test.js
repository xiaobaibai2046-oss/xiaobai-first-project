import test from 'node:test';
import assert from 'node:assert/strict';
import {routes} from '../data.js';
import {routePoints,mercatorPoint,fitMapView,routeSegmentUncertain} from '../route-map.js';
test('every route has a coordinate per stop and fits the overview viewport',()=>{for(const route of routes){const points=routePoints(route);assert.equal(points.length,route.stops.length);for(const [w,h] of [[390,330],[1000,400]]){const view=fitMapView(points,w,h),scale=256*2**view.z;for(const p of points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(Math.abs(p.x-view.x)*scale<=w/2,route.id);assert.ok(Math.abs(p.y-view.y)*scale<=h/2,route.id);}}}});
test('projection and closed-loop endpoints agree',()=>{assert.deepEqual(mercatorPoint(0,0),{x:0.5,y:0.5});const loop=routePoints(routes.find(r=>r.id==='lopnur-loop'));assert.equal(loop[0].x,loop.at(-1).x);assert.equal(loop[0].y,loop.at(-1).y);assert.ok(Number.isFinite(mercatorPoint(90,90).y));});
test('uncertain crossings have dashed-line flags',()=>{assert.equal(routeSegmentUncertain(routes.find(r=>r.id==='gaize-minfeng'),0),true);const r=routes.find(r=>r.id==='lopnur-loop');assert.equal(routeSegmentUncertain(r,1),true);assert.equal(routeSegmentUncertain(r,2),true);assert.equal(routeSegmentUncertain(r,0),false);});
