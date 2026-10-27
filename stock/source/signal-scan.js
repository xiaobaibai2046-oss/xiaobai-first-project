import {summarizeStock} from './conclusion.js';
import {signalRecord,signalState} from './signal-model.js';
export async function scanStock(code,request,now=()=>new Date()){
 const values={},errors={};async function load(kind){try{const data=await request(kind,code);if(kind==='quote'){const q=data.quotes?.find(x=>x.code===code);if(!q)throw Error('报价中缺少股票');values.quote=q;values.quoteSource=data.source}else values[kind]=data}catch(e){errors[kind]=e.message}}
 function summary(){const s=summarizeStock({code,...values,errors,now:now(),includeSimulation:false});s.signalSources={daily:values.history?.source||null,hourly:values.hourly?.source||null,quote:values.quoteSource||null,financial:values.financial?.source||null};return s}
 await load('history');let s=summary();if(signalRecord(s,now()).state==='sell')return signalRecord(s,now());
 await load('hourly');s=summary();if(signalRecord(s,now()).state==='sell')return signalRecord(s,now());
 if(s.technical?.trend&&s.macd?.bullish?.active){await Promise.all([load('quote'),load('financial')]);s=summary()}
 return signalRecord(s,now());
}
export function createSignalScanner({stocks,records,request,onResult,onProgress,delay=1500,concurrency=2,now=()=>new Date()}){
 let running=false,stopped=false,activePromise=null;
 async function start({retry=false}={}){
  if(running)return activePromise;running=true;stopped=false;
  const targets=stocks().filter(s=>{const state=signalState(records()[s.code],now());return state==='unscanned'||state==='stale'||retry&&state==='incomplete'});let next=0,done=0,consecutiveFailures=0,dailyFailures=0;onProgress({running:true,done:0,total:targets.length,stopped:false,reason:null});
  activePromise=Promise.all(Array.from({length:Math.min(concurrency,targets.length)},async()=>{while(!stopped&&next<targets.length){const stock=targets[next++];let record;try{record=await scanStock(stock.code,request,now)}catch(e){record=signalRecord({code:stock.code,technical:null,macd:null,missing:[e.message],errors:{analysis:e.message},tradeHints:{buy:{triggered:false},sell:{triggered:false}}},now())}onResult(record);done++;const transport=m=>typeof m==='string'&&/连接|超时|拒绝|限流|进程退出|HTTP|TEST.*(?:denied|outage)/i.test(m);consecutiveFailures=transport(record.errors.history)&&transport(record.errors.hourly)?consecutiveFailures+1:0;dailyFailures=transport(record.errors.history)?dailyFailures+1:0;if(consecutiveFailures>=6||dailyFailures>=6)stopped=true;onProgress({running:true,done,total:targets.length,stopped,reason:consecutiveFailures>=6||dailyFailures>=6?'行情源连续失败，已暂停；请待数据源恢复后继续，保留已核验结果':null});if(!stopped&&next<targets.length)await new Promise(r=>setTimeout(r,delay))}})).finally(()=>{running=false;onProgress({running:false,done,total:targets.length,stopped,reason:consecutiveFailures>=6||dailyFailures>=6?'行情源连续失败，已暂停；请待数据源恢复后继续，保留已核验结果':null})});return activePromise;
 }
 return {start,pause:()=>{stopped=true},isRunning:()=>running};
}
