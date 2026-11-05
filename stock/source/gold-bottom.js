// Adjacent confirmed golden crosses; all comparisons use information available at that close.
export function findGoldCrossBottoms(bars,series,{nearBars=5,minBars=100}={}){
 if(bars.length!==series.length)throw Error('MACD与K线数量不一致');
 let previous=null;const events=[];
 for(let i=1;i<bars.length;i++){
  if(!(series[i].dif>series[i].dea&&series[i-1].dif<=series[i-1].dea))continue;
  if(previous!==null&&i+1>=minBars){
   const start=Math.max(0,previous-nearBars+1);let firstLow=start;
   for(let j=start;j<=previous;j++)if(bars[j].low<=bars[firstLow].low)firstLow=j;
   let low=previous+1;for(let j=previous+1;j<=i;j++)if(bars[j].low<=bars[low].low)low=j;
   if(series[i].dif>series[previous].dif&&bars[low].low<bars[firstLow].low){
    const ref=bars.slice(Math.max(0,firstLow-2),firstLow+1).reduce((s,b)=>s+b.volume,0)/Math.min(3,firstLow+1);
    events.push({kind:'bullish',mode:'gold_cross_dif',firstIndex:previous,secondIndex:i,confirmedIndex:i,firstTime:bars[previous].endTime,secondTime:bars[i].endTime,confirmedAt:bars[i].endTime,firstDIF:series[previous].dif,secondDIF:series[i].dif,firstPrice:bars[firstLow].low,secondPrice:bars[low].low,lowTime:bars[low].endTime,lowIndex:low,close:bars[i].close,previousLowVolumeMean:ref,currentVolume:bars[low].volume,volumeRatio:ref>0?bars[low].volume/ref:null,volumeRisk:ref>0&&bars[low].volume>ref,active:i===bars.length-1,priceMatch:'strict',priceTolerance:0,nearBars});
   }
  }
  previous=i;
 }
 return {bullish:events.at(-1)||null,events};
}
export function goldCrossDailyMA20(event,dailyBars){
 if(!event)return null;
 const date=event.secondTime.slice(0,10),past=(dailyBars||[]).filter(b=>b.date<date).slice(-19);
 if(past.length!==19||past.some(b=>!Number.isFinite(b.close)))return null;
 const ma20=(past.reduce((s,b)=>s+b.close,0)+event.close)/20;
 return {ma20,close:event.close,date,passed:event.close>ma20,method:'前19个交易日收盘价＋金叉小时收盘价'};
}
