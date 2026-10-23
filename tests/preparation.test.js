import test from 'node:test';
import assert from 'node:assert/strict';
import {routes,roadbook} from '../data.js';
import {getPreparation} from '../preparation.js';
test('all routes have a checklist with unique item IDs and actionable risks',()=>{for(const route of routes){const p=getPreparation(route),items=p.groups.flatMap(g=>g.items);assert.equal(new Set(items.map(i=>i.id)).size,items.length);assert.ok(items.length>=17);assert.ok(p.risks.length>=4);for(const r of p.risks){assert.ok(r.prevention);assert.ok(r.action);}}});
test('different environments receive relevant preparation, not identical lists',()=>{const byId=id=>getPreparation(routes.find(r=>r.id===id));assert.ok(byId('sichuan').groups.some(g=>g.title==='高原专项'));assert.ok(byId('qiemo-tazhong').groups.some(g=>g.title==='荒漠专项'));assert.ok(!byId('ili').groups.some(g=>g.title==='高原专项'));assert.ok(byId('lopnur-loop').risks.some(r=>r.title.includes('通行限制')));});
test('export includes packing status and actionable risk guidance',()=>{const text=roadbook(routes[0],['water']);assert.ok(text.includes('[x] 饮用水'));assert.ok(text.includes('[ ] 身份证'));assert.ok(text.includes('高原反应'));assert.ok(text.includes('应对：'));assert.ok(text.includes('急救 120'));});
