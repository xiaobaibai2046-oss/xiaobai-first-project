import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {SIGNAL_RULE,signalCounts,mergeSignals} from '../signal-model.js';import {createSignalScanner} from '../signal-scan.js';
import {shardStocks,planSignalBatch} from '../scan-plan.js';
const shard=Number(process.env.SCAN_SHARD||0),shards=Number(process.env.SCAN_SHARDS||1);
const root=new URL('../',import.meta.url),file=new URL(shards>1?'scan-results/shard-'+shard+'.json':'pool-signals.json',root),pool=JSON.parse(await readFile(new URL('pool-2025.json',root),'utf8'));
let data={schema_version:1,rule:SIGNAL_RULE,started_at:new Date().toISOString(),finished_at:null,attempted_all:false,results:{}};
try{const old=JSON.parse(await readFile(new URL('pool-signals.json',root),'utf8'));if(old.rule===SIGNAL_RULE)data={...data,results:old.results||{}}}catch{}
const child=spawn('python3',[fileURLToPath(new URL('./scan-fetch.py',import.meta.url))],{stdio:['pipe','pipe','inherit']});let id=0;const waiting=new Map();
createInterface({input:child.stdout}).on('line',line=>{const r=JSON.parse(line),p=waiting.get(r.id);if(!p)return;waiting.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.data)});
child.on('exit',()=>{for(const p of waiting.values())p.reject(Error('行情读取进程退出'));waiting.clear()});
const request=(kind,code)=>new Promise((resolve,reject)=>{const key=++id;waiting.set(key,{resolve,reject});child.stdin.write(JSON.stringify({id:key,kind,code})+'\n')});
const assigned=shardStocks(pool.stocks,shard,shards);
const assignedCodes=new Set(assigned.map(s=>s.code));data.results=Object.fromEntries(Object.entries(data.results).filter(([code])=>assignedCodes.has(code)));
await mkdir(new URL('./',file),{recursive:true});
const batchSize=Math.max(1,Math.min(pool.stocks.length,Number(process.env.SCAN_BATCH_SIZE)||pool.stocks.length));
const deadline=Date.now()+Math.max(60,Number(process.env.SCAN_SECONDS)||840)*1000;
const candidates=planSignalBatch(pool.stocks,data.results,{shard,shards,limit:batchSize});
const timer=setTimeout(()=>scanner.pause(),Math.max(1,deadline-Date.now()));
let writeQueue=Promise.resolve();const persist=()=>{const text=JSON.stringify({...data,counts:signalCounts(assigned,data.results)},null,0);writeQueue=writeQueue.then(async()=>{const temp=fileURLToPath(file)+'.tmp';await writeFile(temp,text);await rename(temp,file)});return writeQueue};
const scanner=createSignalScanner({stocks:()=>candidates,records:()=>data.results,request,onResult:r=>{data.results=mergeSignals(data.results,{[r.code]:r},assignedCodes)},onProgress:p=>{data.background={shard,shards,status:p.running?'running':p.reason?'source_unavailable':p.stopped?'paused':'batch_complete',checked:p.done,batch_total:p.total,updated_at:new Date().toISOString(),message:p.reason||null};if(p.done%20===0||!p.running||p.reason){console.log(JSON.stringify({...p,counts:signalCounts(assigned,data.results)}));persist()}},delay:1500,concurrency:1});
process.on('SIGINT',()=>scanner.pause());process.on('SIGTERM',()=>scanner.pause());
try{for(let attempt=0;attempt<4&&Date.now()<deadline;attempt++){await scanner.start({retry:true});await persist();if(data.background.status!=='source_unavailable')break;const wait=30000*2**attempt;if(attempt===3||Date.now()+wait>=deadline)break;data.background.status='backoff';data.background.message=`行情连续失败，${wait/1000}秒后重试（${attempt+1}/3）`;await persist();await new Promise(r=>setTimeout(r,wait));}data.finished_at=new Date().toISOString();data.attempted_all=assigned.every(s=>!!data.results[s.code]);await persist();await writeQueue;console.log('SAVED',data.finished_at,JSON.stringify(signalCounts(assigned,data.results)))}finally{clearTimeout(timer);child.stdin.end()}
