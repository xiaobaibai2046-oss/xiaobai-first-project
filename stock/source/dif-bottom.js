import {TRUE_DIF_STAGE_BARS,TRUE_DIF_MIN_BARS,TRUE_DIF_VOLUME_BARS} from './strategy-config.js';
// Only past and current CLOSED bars are read. Gold/death crosses delimit the
// same down-wave snapshots as the TDX formula; repeated lows in one wave do not
// increment the consecutive-wave divergence count.
export function findTrueDifBottoms(bars,series,{stageBars=TRUE_DIF_STAGE_BARS,minBars=TRUE_DIF_MIN_BARS,volumeBars=TRUE_DIF_VOLUME_BARS}={}){
 if(bars.length!==series.length)throw Error('MACD与K线数量不一致');
 if(!Number.isInteger(stageBars)||stageBars<1||!Number.isInteger(volumeBars)||volumeBars<1)throw Error('真DIF底背离窗口无效');
 const events=[],completedWaves=[];let death=-1,goldCount=0,previous=null;
 const stageLow=i=>i>0&&bars[i].low<Math.min(...bars.slice(Math.max(0,i-stageBars),i).map(b=>b.low));
 function wave(start,end){
  let low=start;
  for(let j=start;j<=end;j++)if(bars[j].low<=bars[low].low)low=j; // LLVBARS selects the latest equal low.
  const volumeReference=bars.slice(Math.max(0,low-volumeBars+1),low+1).reduce((s,b)=>s+b.volume,0)/Math.min(volumeBars,low+1);
  return {start,end,lowIndex:low,price:bars[low].low,dif:series[low].dif,minDIF:Math.min(...series.slice(start,end+1).map(m=>m.dif)),greenPeak:-Math.min(...series.slice(start,end+1).map(m=>m.histogram)),volume:bars[low].volume,volumeReference,stageLow:stageLow(low)};
 }
 function qualifies(current,prior){
  return !!prior&&current.stageLow&&current.price<prior.price&&current.dif<0&&prior.dif<0&&current.dif>prior.dif&&current.minDIF>prior.minDIF&&current.greenPeak<prior.greenPeak&&current.volume<prior.volumeReference;
 }
 for(let i=1;i<bars.length;i++){
  const h=series[i].histogram,ph=series[i-1].histogram;
  if(!Number.isFinite(h)||!Number.isFinite(series[i].dif))throw Error('真DIF底背离需要有效DIF和MACD柱');
  if(h<0&&ph>=0)death=i;
  if(h>0&&ph<=0){
   goldCount++;
   if(death>=0&&death<i){
    const closed=wave(death,i-1);closed.qualified=goldCount>=2&&qualifies(closed,previous);
    closed.sequence=closed.qualified?(previous?.sequence||0)+1:0;
    completedWaves.push(closed);previous=closed;
   }
  }
  if(i+1<minBars||goldCount<2||h>=0||death<0||!previous)continue;
  const current=wave(death,i);
  if(current.lowIndex!==i||!qualifies(current,previous))continue;
  const sequence=previous.qualified?previous.sequence+1:1,level=Math.min(3,sequence);
  events.push({kind:'bullish',mode:'true_dif_waves',level,sequence,priceTolerance:0,priceMatch:'strict',priceChangePct:(current.price/previous.price-1)*100,
   firstIndex:previous.lowIndex,secondIndex:i,confirmedIndex:i,firstTime:bars[previous.lowIndex].endTime,secondTime:bars[i].endTime,confirmedAt:bars[i].endTime,
   firstPrice:previous.price,secondPrice:current.price,firstDIF:previous.dif,secondDIF:current.dif,firstMinDIF:previous.minDIF,secondMinDIF:current.minDIF,
   firstGreenPeak:previous.greenPeak,secondGreenPeak:current.greenPeak,previousLowVolumeMean:previous.volumeReference,currentVolume:current.volume,volumeRatio:current.volume/previous.volumeReference,
   stageBars,volumeReferenceBars:volumeBars,active:false,riskActive:false});
 }
 const bullish=events.at(-1)||null;
 if(bullish){const current=bullish.secondIndex===bars.length-1;bullish.active=current&&bullish.level<=2;bullish.riskActive=current&&bullish.level>=3}
 return {bullish,events,completedWaves};
}
