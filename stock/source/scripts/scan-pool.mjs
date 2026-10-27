import {readFile,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {SIGNAL_RULE,signalCounts} from '../signal-model.js';import {createSignalScanner} from '../signal-scan.js';
const root=new URL('../',import.meta.url),file=new URL('pool-signals.json',root),pool=JSON.parse(await readFile(new URL('pool-2025.json',root),'utf8'));
let data={schema_version:1,rule:SIGNAL_RULE,started_at:new Date().toISOString(),finished_at:null,attempted_all:false,results:{}};
try{const old=JSON.parse(await readFile(file,'utf8'));if(old.rule===SIGNAL_RULE)data={...data,results:old.results||{}}}catch{}
const child=spawn('python3',[fileURLToPath(new URL('./scan-fetch.py',import.meta.url))],{stdio:['pipe','pipe','inherit']});let id=0;const waiting=new Map();
createInterface({input:child.stdout}).on('line',line=>{const r=JSON.parse(line),p=waiting.get(r.id);if(!p)return;waiting.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.data)});
child.on('exit',()=>{for(const p of waiting.values())p.reject(Error('行情读取进程退出'));waiting.clear()});
const request=(kind,code)=>new Promise((resolve,reject)=>{const key=++id;waiting.set(key,{resolve,reject});child.stdin.write(JSON.stringify({id:key,kind,code})+'\n')});
let writeQueue=Promise.resolve();const persist=()=>{const text=JSON.stringify({...data,counts:signalCounts(pool.stocks,data.results)},null,0);writeQueue=writeQueue.then(async()=>{const temp=fileURLToPath(file)+'.tmp';await writeFile(temp,text);await rename(temp,file)});return writeQueue};
const scanner=createSignalScanner({stocks:()=>pool.stocks,records:()=>data.results,request,onResult:r=>{data.results[r.code]=r},onProgress:p=>{if(p.done%20===0||!p.running||p.reason){console.log(JSON.stringify({...p,counts:signalCounts(pool.stocks,data.results)}));persist()}},delay:1500,concurrency:2});
process.on('SIGINT',()=>scanner.pause());process.on('SIGTERM',()=>scanner.pause());
try{await scanner.start({retry:true});data.finished_at=new Date().toISOString();data.attempted_all=pool.stocks.every(s=>!!data.results[s.code]);await persist();await writeQueue;console.log('SAVED',data.finished_at,JSON.stringify(signalCounts(pool.stocks,data.results)))}finally{child.stdin.end()}
