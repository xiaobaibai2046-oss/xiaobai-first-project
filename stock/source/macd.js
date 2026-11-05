import {findTrueDifBottoms} from './dif-bottom.js';
import {BOTTOM_PRICE_TOLERANCE} from './strategy-config.js';
// EMA seeds with the first close; discard 78 bars before looking for pivots.
export function computeMACD(closes){
 if(!Array.isArray(closes)||!closes.length||closes.some(x=>!Number.isFinite(x)||x<=0))throw Error('MACD 需要有效正收盘价');
 let fast=closes[0],slow=closes[0],dea=0;
 return closes.map(close=>{fast+=2/13*(close-fast);slow+=2/27*(close-slow);const dif=fast-slow;dea+=2/10*(dif-dea);return {dif,dea,histogram:2*(dif-dea)}});
}
export function findDivergences(bars,macd,{warmup=78,pivotWidth=2,minGap=5,maxGap=60,activeBars=8,priceTolerance=BOTTOM_PRICE_TOLERANCE}={}){
 if(!Number.isFinite(priceTolerance)||priceTolerance<0||priceTolerance>0.01)throw Error('底背离价格容差须在0至1%之间');
 if(bars.length!==macd.length)throw Error('MACD 与 K 线数量不一致');
 const lows=[],highs=[],bullish=[],bearish=[];
 for(let i=Math.max(warmup,pivotWidth);i<bars.length-pivotWidth;i++){
  const window=bars.slice(i-pivotWidth,i+pivotWidth+1);
  const isLow=window.every((b,j)=>j===pivotWidth||b.low>bars[i].low);
  const isHigh=window.every((b,j)=>j===pivotWidth||b.high<bars[i].high);
  for(const [isPivot,points,kind,events] of [[isLow,lows,'bullish',bullish],[isHigh,highs,'bearish',bearish]]){
   if(!isPivot)continue;const a=points.at(-1);points.push(i);if(a===undefined||i-a<minGap||i-a>maxGap)continue;
   const before=macd[a].dif,after=macd[i].dif;
   const priceChange=bars[i].low/bars[a].low-1;
   const bottomPrice=bars[i].low<bars[a].low||(priceTolerance>0&&priceChange<=priceTolerance+1e-12);
   const matches=kind==='bullish'?bottomPrice&&after>before+1e-8&&before<0&&after<0:bars[i].high>bars[a].high&&after<before-1e-8&&before>0&&after>0;
   if(matches){const confirmedIndex=i+pivotWidth;events.push({kind,priceTolerance:kind==='bullish'?priceTolerance:0,priceMatch:kind==='bullish'&&bars[i].low>=bars[a].low?'near_low':'strict',priceChangePct:kind==='bullish'?priceChange*100:(bars[i].high/bars[a].high-1)*100,firstIndex:a,secondIndex:i,confirmedIndex,firstTime:bars[a].endTime,secondTime:bars[i].endTime,confirmedAt:bars[confirmedIndex].endTime,firstPrice:kind==='bullish'?bars[a].low:bars[a].high,secondPrice:kind==='bullish'?bars[i].low:bars[i].high,firstDIF:before,secondDIF:after,active:bars.length-1-confirmedIndex<activeBars})}
  }
 }
 return {bullish:bullish.at(-1)||null,bearish:bearish.at(-1)||null};
}
export function analyzeHourlyMACD(bars){
 if(!Array.isArray(bars)||bars.length<100)throw Error('60 分钟 MACD 至少需要 100 根已完成 K 线');
 for(let i=0;i<bars.length;i++){
  const b=bars[i];if(!b.endTime||!Number.isFinite(Date.parse(b.endTime))||i&&b.endTime<=bars[i-1].endTime||!['open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||Math.min(b.open,b.high,b.low,b.close)<=0||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close))throw Error('60 分钟 K 线格式、顺序或价格无效');
 }
 const series=computeMACD(bars.map(x=>x.close)),legacyTop=findDivergences(bars,series).bearish,strict=findTrueDifBottoms(bars,series);
 return {bullish:strict.bullish,bearish:legacyTop,latest:series.at(-1),asOf:bars.at(-1).endTime,count:bars.length,
  parameters:{fast:12,slow:26,signal:9,bottom:{mode:'true_dif_waves',stageBars:60,minBars:100,volumeReferenceBars:3,allowedLevels:[1,2],priceTolerance:0,confirmation:'latest_closed_new_low_bar'},top:{warmup:78,pivotWidth:2,minGap:5,maxGap:60,activeBars:8}},
  method:'真DIF底背离：最新收盘K线严格创前60根阶段新低，比较前一完整MACD绿柱波段；低点DIF及整轮最低DIF均抬高，绿柱峰值变浅，成交量低于前波低点及前两根均量。一、二次可选，三次及以上过滤；仅满足条件的当前K线收盘触发，不延续8根、不再等待右侧两根。顶背离仍按原分型、右侧两根确认和8根有效规则。'};
}
export function makeTradeHints({technical,macd,dailyFresh,hourlyFresh}){
 const bottom=!!(hourlyFresh&&macd?.bullish?.active&&!macd.bullish.riskActive&&(macd.bullish.level||1)<=2),top=!!(hourlyFresh&&macd?.bearish?.active);
 const below=!!(dailyFresh&&technical&&technical.close<technical.ma20);
 const sell=below||top,buy=bottom;
 const event=macd?.bullish,risk=!!(hourlyFresh&&event?.riskActive);
 const buyReasons=[!hourlyFresh?'60分钟数据不足或过期':risk?'三次及以上真DIF底背离：风险过滤，不列入买入':bottom?(event.level===2?'二次真DIF底背离':'一次真DIF底背离'):'最新已收盘60分钟K线未满足真DIF底背离'];
 if(bottom&&event.mode==='true_dif_waves')buyReasons.push(`严格创前${event.stageBars}根新低；低点DIF ${event.firstDIF.toFixed(4)} → ${event.secondDIF.toFixed(4)}；整轮最低DIF抬高；绿柱峰值 ${event.firstGreenPeak.toFixed(4)} → ${event.secondGreenPeak.toFixed(4)}；新低成交量为前波低点附近均量的${(event.volumeRatio*100).toFixed(1)}%`);
 if(buy&&sell)buyReasons.push('同时存在卖出观察条件，请结合卖出提示核对；不取消底背离买入信号');
 const sellReasons=[];if(!dailyFresh)sellReasons.push('近期日线不足，不能判断是否跌破MA20');if(below)sellReasons.push('日线收盘低于 MA20');if(top)sellReasons.push('近期已确认60分钟MACD顶背离');if(!hourlyFresh)sellReasons.push('60分钟数据不足，不能判断顶背离');
 return {buy:{triggered:buy,title:buy?'触发买入观察':risk?'三次及以上背离，风险过滤':!hourlyFresh?'数据不足，暂不生成买入提示':'暂未触发买入条件',reasons:buyReasons},sell:{triggered:sell,title:sell?'触发卖出／减仓观察':!dailyFresh||!hourlyFresh?'卖出条件暂不能完整判断':'暂未触发卖出条件',reasons:sellReasons.length?sellReasons:['未发现跌破 MA20 或近期已确认的60分钟MACD顶背离']},bottom,top,note:`先满足2025年ROE > 10%。技术买入只选当前完整60分钟K线上成立的一次、二次真DIF底背离：严格阶段新低、低点DIF和整轮最低DIF抬高、绿柱峰值变浅、缩量；三次及以上过滤。无近前低容差，不再沿用旧底部右侧两根确认或8根延续。卖出仍按跌破MA20或原60分钟顶背离，可与买入提示并存。不复权价格可能受除权影响，不代表下单。`};
}
export function normalizeHourly(payload,code,now=new Date()){
 const sym=/^(60|68)/.test(code)?'sh'+code:/^(00|30)/.test(code)?'sz'+code:'bj'+code;
 const obj=payload?.data?.[sym],rows=obj?.m60;if(payload?.code!==0||!Array.isArray(rows)||!rows.length)throw Error('数据源没有返回 m60 K线，未用日线代替');
 const bars=[],seen=new Set();let excluded=0;
 for(const row of rows){
  if(!Array.isArray(row)||row.length<6)throw Error('60分钟字段不完整');const raw=String(row[0]);if(!/^(?:\d{12}|\d{14}|\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)$/.test(raw))throw Error('60分钟时间格式发生变化');
  const digits=raw.replace(/\D/g,''),date=`${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`,hm=digits.slice(8,12),endTime=`${date}T${hm.slice(0,2)}:${hm.slice(2)}:00+08:00`;
  if(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('60分钟日期无效');
  if(!['1030','1130','1400','1500'].includes(hm)||Date.parse(endTime)>now.getTime()){excluded++;continue}
  const values=row.slice(1,6).map(x=>x===''||x==null||typeof x==='boolean'?NaN:Number(x)),[open,close,high,low,volume]=values;
  if(values.some(x=>!Number.isFinite(x))||Math.min(open,close,high,low)<=0||volume<0||high<Math.max(open,close)||low>Math.min(open,close)||seen.has(endTime))throw Error('60分钟价格或重复时间无效');seen.add(endTime);bars.push({code,endTime,open,close,high,low,volume});
 }
 bars.sort((a,b)=>a.endTime.localeCompare(b.endTime));if(!bars.length)throw Error('没有符合 A股收盘时段的已完成60分钟K线');
 return {code,bars,timeframe:'60m',adjustment:'none',source:'腾讯财经60分钟K线',last_time:bars.at(-1).endTime,excluded_bars:excluded,session_ends:'北京时间10:30、11:30、14:00、15:00；排除未完成K线'};
}
