// Financial rules describe observable metrics, never audit authenticity or predict returns.
export function financialAnalysis(report) {
 const messages=[],missing=[];
 const known=key=>typeof report[key]==='number'&&Number.isFinite(report[key]);
 const add=(level,title,detail)=>messages.push({level,title,detail});
 if(known('profit'))add(report.profit>0?'positive':'risk','盈利情况',report.profit>0?'累计归母净利润为正；仍需检查非经常性损益。':'累计归母净利润不为正，盈利估值需谨慎。');else missing.push('归母净利润');
 for(const [key,title] of [['revenue_yoy','营收同比'],['profit_yoy','净利润同比']]) {
  if(known(key))add(report[key]>=0?'neutral':'risk',title,`${report[key].toFixed(2)}%；${report[key]<0?'同比下降，需核查业务或基数变化。':'正增长不代表可持续增长，需结合基数。'}`);else missing.push(title);
 }
 if(known('roe'))add('neutral','累计 ROE',`${report.roe.toFixed(2)}%；未年化，不跨不同行业机械排名。`);else missing.push('ROE');
 if(known('ocf_per_share')&&known('eps')&&report.eps>0){const ratio=report.ocf_per_share/report.eps;add(ratio<.8?'risk':'neutral','现金流与盈利匹配',`每股经营现金流 / EPS = ${ratio.toFixed(2)}。${ratio<.8?'低于研究阈值 0.8，需核查回款和营运资金。':'此比值仅为粗略代理，股本和 EPS 口径差异可能影响结果。'}`)}else missing.push('可比较的正 EPS 与每股经营现金流');
 if(!report.notice_date)missing.push('公告日期');
 add('neutral','分析边界','阈值是可解释的研究提示，不是买卖评分。银行、保险等金融行业的经营现金流与毛利率不宜直接套用一般企业框架。');
 return {messages,missing};
}

function validateBars(bars,period){
 if(!Array.isArray(bars)||bars.length<period+2)throw Error(`回测至少需要 ${period+2} 根日线（含均线预热）`);
 const code=bars[0].code;
 for(let i=0;i<bars.length;i++){
  const b=bars[i];
  if(b.code!==code||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date||(i&&b.date<=bars[i-1].date)||!['open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||Math.min(b.open,b.high,b.low,b.close)<=0||b.volume<0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))throw Error('回测需要单一股票、日期严格递增且有效的 OHLCV 数据');
 }
}
export function backtest(bars,options={}) {
 const p={capital:100000,maPeriod:20,riskPct:.5,commissionBps:3,minCommission:5,slippageBps:5,openGuardPct:4.8,start:'',end:'',...options};
 for(const key of ['capital','maPeriod','riskPct','commissionBps','minCommission','slippageBps','openGuardPct'])if(typeof p[key]!=='number'||!Number.isFinite(p[key]))throw Error('回测参数必须为有效数字');
 if(p.capital<=0||p.riskPct<=0||p.riskPct>5||p.maPeriod!==20||p.commissionBps<0||p.commissionBps>100||p.slippageBps<0||p.slippageBps>100||p.minCommission<0||p.openGuardPct<=0||p.openGuardPct>4.8)throw Error('回测参数超出范围：仅使用 MA20；风险 ≤5%；开盘过滤 ≤4.8%');
 for(const key of ['start','end'])if(p[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(p[key])||!Number.isFinite(Date.parse(p[key]))||new Date(p[key]).toISOString().slice(0,10)!==p[key]))throw Error('回测日期无效');
 if(p.start&&p.end&&p.start>p.end)throw Error('开始日期不能晚于结束日期');
 validateBars(bars,p.maPeriod);
 if(p.start&&p.start<bars[p.maPeriod].date)throw Error('开始日期之前没有足够预热数据，请选择不早于 '+bars[p.maPeriod].date+' 的日期');
 if(p.end&&p.end>bars.at(-1).date)throw Error('结束日期超出已有日线范围');
 const mean=(i,n)=>bars.slice(i-n+1,i+1).reduce((s,b)=>s+b.close,0)/n;
 const atr=i=>{let total=0;for(let j=i-13;j<=i;j++){const b=bars[j],prev=bars[j-1].close;total+=Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev))}return total/14};
 const fees=(notional,date,sell)=>Math.max(p.minCommission,notional*p.commissionBps/10000)+notional*(date>='2022-04-29'?.00001:.00002)+(sell?notional*(date>='2023-08-28'?.0005:.001):0);
 let cash=p.capital,position=null,pending=null,peak=p.capital,maxDD=0,totalFees=0,blocked=0,firstClose=null,gapCount=0;
 const equity=[],trades=[],executions=[],events=[];
 for(let i=p.maPeriod;i<bars.length;i++){
  const b=bars[i],prev=bars[i-1];if(p.start&&b.date<p.start)continue;if(p.end&&b.date>p.end)break;
  if(firstClose===null)firstClose=b.close;
  const gap=b.open/prev.close-1;if(Math.abs(gap)>.25)gapCount++;
  const suspended=b.volume===0;
  if(pending){
   const buy=pending.side==='BUY';
   const guarded=buy?gap>=p.openGuardPct/100:gap<=-p.openGuardPct/100;
   const explicitLock=buy?(Number.isFinite(b.limitUp)&&b.open>=b.limitUp-.001):(Number.isFinite(b.limitDown)&&b.open<=b.limitDown+.001);
   if(suspended||guarded||explicitLock){blocked++;events.push({date:b.date,type:'BLOCKED',side:pending.side,reason:suspended?'零成交量':explicitLock?'开盘触及导入涨跌停价':'保守开盘涨跌幅过滤'});}
   else if(buy&&!position){
    const price=b.open*(1+p.slippageBps/10000),distance=pending.atr*2;
    let quantity=distance>0?Math.floor((cash*p.riskPct/100)/distance/100)*100:0;
    quantity=Math.min(quantity,Math.floor(cash/price/100)*100);
    while(quantity>0&&quantity*price+fees(quantity*price,b.date,false)>cash)quantity-=100;
    if(quantity>0&&price>distance){const cost=fees(quantity*price,b.date,false);cash-=quantity*price+cost;totalFees+=cost;position={date:b.date,price,quantity,buyFee:cost,stop:price-distance,signalDate:pending.signalDate};executions.push({date:b.date,side:'BUY',price,quantity,fee:cost,signalDate:pending.signalDate});}
   }else if(!buy&&position&&b.date>position.date){
    const price=b.open*(1-p.slippageBps/10000),cost=fees(position.quantity*price,b.date,true);cash+=position.quantity*price-cost;totalFees+=cost;
    const pnl=(price-position.price)*position.quantity-position.buyFee-cost;
    trades.push({entryDate:position.date,exitDate:b.date,entry:position.price,exit:price,quantity:position.quantity,pnl,fees:position.buyFee+cost,reason:pending.reason});
    executions.push({date:b.date,side:'SELL',price,quantity:position.quantity,fee:cost,signalDate:pending.signalDate});position=null;
   }
   pending=null;
  }
  const value=cash+(position?position.quantity*b.close:0);peak=Math.max(peak,value);maxDD=Math.max(maxDD,1-value/peak);
  equity.push({date:b.date,value,benchmark:p.capital*b.close/firstClose,cash,quantity:position?.quantity||0});
  if(!suspended){const ma20=mean(i,20);if(position&&(b.close<ma20||b.close<=position.stop))pending={side:'SELL',signalDate:b.date,reason:b.close<=position.stop?'收盘触及风险退出线':'收盘低于MA20'};else if(!position&&b.close>ma20)pending={side:'BUY',signalDate:b.date,atr:atr(i)};}
 }
 if(equity.length<2)throw Error('选定日期内至少需要两个可回测交易日');
 const end=equity.at(-1),wins=trades.filter(t=>t.pnl>0).length;
 return {parameters:p,start:equity[0].date,end:end.date,finalEquity:end.value,totalReturn:end.value/p.capital-1,benchmarkReturn:end.benchmark/p.capital-1,maxDrawdown:maxDD,closedTrades:trades.length,winRate:trades.length?wins/trades.length:null,totalFees,blockedOrders:blocked,position,unexecutedSignal:pending,equity,trades,executions,events,warnings:[
  '仅 MA20 日线基准实验，未包含60分钟MACD背离，不代表新联合策略的历史收益；非全 A 股选股回测。',
  '收盘后生成信号，下一根日线开盘尝试成交；风险退出也在下一开盘执行。T+1、零成交量、费用和滑点已建模。',
  `开盘涨跌幅达到 ±${p.openGuardPct}% 时对应方向不成交，这是保守过滤，不等于真实涨跌停制度；缺少历史 ST、新股和涨跌停状态。`,
  '默认 100 股整手，仅支持普通沪深主板；未建模分红、送转、配股、排队、成交量容量和退市。未强制平仓，期末持仓按收盘计值且未扣未来卖出费。',
  '不复权数据遇除权会失真；前复权导入也不等同真实资金账户。请避开公司行动窗口或补齐事件数据。',
  '基准为区间首日收盘至末日收盘价格变化，不计费用与分红。当前财务摘要从未用于历史信号，避免把最新财务回填过去。',
  ...(gapCount?[`发现 ${gapCount} 个绝对开盘跳空超过 25% 的交易日，可能存在公司行动或异常行情，结果需人工核查。`]:[])
 ]};
}
