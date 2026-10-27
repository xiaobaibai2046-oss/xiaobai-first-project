import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backtest,financialAnalysis} from './research.js';
function bars(count=100){const start=Date.UTC(2025,0,1);return Array.from({length:count},(_,i)=>{const close=10+i*.02;return {code:'600001',name:'测试股票',date:new Date(start+i*86400000).toISOString().slice(0,10),open:close-.01,close,high:close+.1,low:close-.1,volume:10000}})}
function roundTrip(){const a=bars();for(let i=70;i<a.length;i++)Object.assign(a[i],{open:8,close:8,high:8.1,low:7.9});return a}
test('signals execute only on a later day; cash/positions reconcile to equity',()=>{
 const r=backtest(bars());assert.equal(r.executions[0].signalDate,bars()[60].date);assert.equal(r.executions[0].date,bars()[61].date);
 assert.equal(r.closedTrades,0);assert.equal(r.winRate,null);assert.ok(r.position);
 for(const e of r.executions)assert.ok(e.date>e.signalDate);
 for(const e of r.equity){assert.ok(e.cash>=0);const b=bars().find(b=>b.date===e.date);assert.ok(Math.abs(e.value-e.cash-e.quantity*b.close)<1e-8)}
 assert.ok(r.totalFees>0);assert.equal(r.equity.at(-1).quantity,r.position.quantity);
});
test('T+1, fees and sell tax reduce realized P&L; no same day exit',()=>{
 const r=backtest(roundTrip(),{openGuardPct:4.8});assert.ok(r.closedTrades>0);
 const t=r.trades[0];assert.ok(t.exitDate>t.entryDate);assert.ok(t.fees>=10);assert.ok(t.pnl<0);
 assert.ok(Math.abs(r.finalEquity-100000-r.trades.reduce((s,t)=>s+t.pnl,0))<1e-7);
 const sell=r.executions.find(e=>e.side==='SELL');const sellNotional=sell.quantity*sell.price;
 assert.ok(Math.abs(sell.fee-(Math.max(5,sellNotional*.0003)+sellNotional*.00001+sellNotional*.0005))<1e-8);
});
test('higher execution costs lower outcome; past signal is invariant to future bars',()=>{
 const plain=backtest(bars(),{commissionBps:0,minCommission:0,slippageBps:0});const costly=backtest(bars(),{commissionBps:30,minCommission:20,slippageBps:30});assert.ok(plain.finalEquity>costly.finalEquity);
 const a=bars(),changed=bars();for(let i=80;i<changed.length;i++)Object.assign(changed[i],{open:100,close:100,high:101,low:99});
 assert.deepEqual(backtest(a).equity.filter(x=>x.date<a[80].date),backtest(changed).equity.filter(x=>x.date<a[80].date));
});
test('zero volume and gap guards prevent immediate fill, with explicit event',()=>{
 const a=bars();a[61].volume=0;const r=backtest(a);assert.ok(r.events.some(e=>e.date===a[61].date&&e.reason==='零成交量'));assert.notEqual(r.executions[0]?.date,a[61].date);
 const b=bars();b[61].open=b[60].close*1.1;b[61].high=b[61].open+.1;b[61].close=b[61].open;const gap=backtest(b);assert.ok(gap.events.some(e=>e.date===b[61].date&&e.side==='BUY'));
});
test('explicit limit price blocks entry and period bounds require warmup',()=>{
 const a=bars();a[61].limitUp=a[61].open;assert.equal(backtest(a).events[0].reason,'开盘触及导入涨跌停价');
 assert.throws(()=>backtest(a,{start:a[10].date}),/预热/);assert.throws(()=>backtest(a,{end:'2099-01-01'}),/超出/);
 const r=backtest(a,{start:a[65].date,end:a[80].date});assert.equal(r.start,a[65].date);assert.equal(r.end,a[80].date);
});
test('zero ATR and insufficient cash create zero trades, not infinite shares',()=>{
 const a=bars().map(x=>({...x,open:10,close:10,high:10,low:10}));const r=backtest(a);assert.equal(r.executions.length,0);assert.equal(r.totalReturn,0);assert.equal(r.winRate,null);
 assert.equal(backtest(bars(),{capital:1}).executions.length,0);
});
test('input validation rejects mixed symbols, invalid OHLC, unsorted dates and nonfinite parameters',()=>{
 const a=bars();assert.throws(()=>backtest(a,{riskPct:Infinity}),/数字/);assert.throws(()=>backtest(a,{fast:60,slow:20}),/范围/);
 assert.throws(()=>backtest(a.slice(0,61)),/62/);const mixed=bars();mixed[65].code='000001';assert.throws(()=>backtest(mixed),/单一/);
 const invalid=bars();invalid[70].low=100;assert.throws(()=>backtest(invalid),/OHLCV/);
 assert.throws(()=>backtest([...a].reverse()),/递增/);assert.throws(()=>backtest(a,{start:'2025-02-30'}),/日期/);
});
test('financial analysis does not convert unknown fields into positive signals',()=>{
 const a=financialAnalysis({profit:null,revenue_yoy:null,profit_yoy:-10,roe:null,eps:1,ocf_per_share:-.2,notice_date:null});
 assert.ok(a.missing.includes('归母净利润'));assert.ok(a.missing.includes('公告日期'));assert.ok(a.messages.some(x=>x.title==='现金流与盈利匹配'&&x.level==='risk'));
 const b=financialAnalysis({profit:10,revenue_yoy:10,profit_yoy:10,roe:10,eps:-1,ocf_per_share:3,notice_date:'2025-01-01'});assert.ok(b.missing.includes('可比较的正 EPS 与每股经营现金流'));
});
