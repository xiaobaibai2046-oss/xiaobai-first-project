import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {SIGNAL_RULE,signalCounts,mergeSignals} from '../signal-model.js';
import {createSignalScanner} from '../signal-scan.js';
import {shardStocks,planSignalBatch} from '../scan-plan.js';
import {runScanCycles} from './scan-cycles.mjs';
const shard=Number(process.env.SCAN_SHARD||0),shards=Number(process.env.SCAN_SHARDS||1);
const root=new URL('../',import.meta.url),file=new URL(shards>1?'scan-results/shard-'+shard+'.json':'pool-signals.json',root);
const pool=JSON.parse(await readFile(new URL('pool-2025.json',root),'utf8'));
const config=JSON.parse(await readFile(new URL('market-config.json',root),'utf8'));
const marketGeneration=(process.env.TDX_DATA_KEY||process.env.TDX_CONFIG_FILE)?config.refresh_generation+':'+(process.env.TDX_ADJUSTMENT||'none'):null;
const data={schema_version:1,rule:SIGNAL_RULE,started_at:new Date().toISOString(),finished_at:null,attempted_all:false,results:{}};
try{const old=JSON.parse(await readFile(new URL('pool-signals.json',root),'utf8'));if(old.rule===SIGNAL_RULE)data.results=old.results||{}}catch{}
const child=spawn('python3',[fileURLToPath(new URL('./scan-fetch.py',import.meta.url))],{stdio:['pipe','pipe','inherit']});
let id=0;const waiting=new Map(),metrics={requests:0,cache_hits:0,errors:0};
createInterface({input:child.stdout}).on('line',line=>{
 const r=JSON.parse(line),p=waiting.get(r.id);if(!p)return;waiting.delete(r.id);
 metrics.requests++;if(r.data?.cloud_cache_hit)metrics.cache_hits++;if(r.error)metrics.errors++;
 r.error?p.reject(Error(r.error)):p.resolve(r.data);
});
child.on('exit',()=>{for(const p of waiting.values())p.reject(Error('行情读取进程退出'));waiting.clear()});
const request=(kind,code)=>new Promise((resolve,reject)=>{const key=++id;waiting.set(key,{resolve,reject});child.stdin.write(JSON.stringify({id:key,kind,code})+'\n')});
const assigned=shardStocks(pool.stocks,shard,shards),assignedCodes=new Set(assigned.map(s=>s.code));
data.results=Object.fromEntries(Object.entries(data.results).filter(([code])=>assignedCodes.has(code)));
await mkdir(new URL('./',file),{recursive:true});
const batchSize=Math.max(1,Math.min(pool.stocks.length,Number(process.env.SCAN_BATCH_SIZE)||pool.stocks.length));
const deadline=Date.now()+Math.max(60,Number(process.env.SCAN_SECONDS)||720)*1000;
let currentScanner=null,stopped=false,checked=0,writeQueue=Promise.resolve();
const persist=()=>{
 const text=JSON.stringify({...data,metrics,counts:signalCounts(assigned,data.results)});
 writeQueue=writeQueue.then(async()=>{const temp=fileURLToPath(file)+'.tmp';await writeFile(temp,text);await rename(temp,file)});
 return writeQueue;
};
const pause=()=>{stopped=true;currentScanner?.pause()};
const timer=setTimeout(pause,Math.max(1,deadline-Date.now()));
process.on('SIGINT',pause);process.on('SIGTERM',pause);
try{
 data.passes=await runScanCycles({
  deadline,stopped:()=>stopped,
  plan:now=>planSignalBatch(pool.stocks,data.results,{shard,shards,limit:batchSize,now,generation:marketGeneration}),
  onBackoff:(delay,attempt)=>{data.background.status='backoff';data.background.message=`行情连续失败，${delay/1000}秒后重试（${attempt}/3）`;persist()},
  scan:async candidates=>{
   const codes=[];
   currentScanner=createSignalScanner({stocks:()=>candidates,records:()=>data.results,request,
    onResult:r=>{if(marketGeneration)r.market_generation=marketGeneration;codes.push(r.code);data.results=mergeSignals(data.results,{[r.code]:r},assignedCodes)},
    onProgress:p=>{
     data.background={shard,shards,phase:process.env.SCAN_PHASE||'full',started_at:data.started_at,
      status:p.running?'running':p.reason?'source_unavailable':p.stopped?'paused':'batch_complete',
      checked:checked+p.done,batch_total:checked+p.total,updated_at:new Date().toISOString(),message:p.reason||null};
     if(p.done%20===0||!p.running||p.reason){console.log(JSON.stringify({...p,counts:signalCounts(assigned,data.results)}));persist()}
    },delay:1500,concurrency:Math.max(1,Math.min(2,Number(process.env.SCAN_CONCURRENCY)||1))});
   await currentScanner.start({retry:true,force:!!marketGeneration});checked+=codes.length;await persist();
   return {codes,status:data.background.status};
  }
 });
 try{data.provider_stats=await request('_stats','000001')}catch{data.provider_stats={unavailable:true}}
 if(data.background)data.background.provider_stats=data.provider_stats;
 data.finished_at=new Date().toISOString();data.attempted_all=assigned.every(s=>!!data.results[s.code]);
 if(stopped&&Date.now()>=deadline&&data.background?.status==='paused')data.background.status='budget_reached';
 if(!data.background)data.background={shard,shards,phase:process.env.SCAN_PHASE||'full',status:'batch_complete',checked:0,batch_total:0,updated_at:data.finished_at,message:null};
 await persist();await writeQueue;
 console.log('SAVED',data.finished_at,JSON.stringify(signalCounts(assigned,data.results)),JSON.stringify(metrics));
}finally{clearTimeout(timer);child.stdin.end()}
