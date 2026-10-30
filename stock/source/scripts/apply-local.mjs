import {readFile,writeFile,rename} from 'node:fs/promises';import {applyLocalUpdate} from '../local-update.js';
const root=new URL('../',import.meta.url),file=new URL('pool-signals.json',root);
let packet;try{packet=JSON.parse(await readFile(new URL('local-signals.json',root),'utf8'))}catch(e){if(e.code==='ENOENT'){console.log('没有本机提交，保留后台结果');process.exit(0)}throw e}
const snapshot=JSON.parse(await readFile(file,'utf8')),pool=JSON.parse(await readFile(new URL('pool-2025.json',root),'utf8'));
const updated=applyLocalUpdate(snapshot,packet,pool.stocks);
if(updated===snapshot){console.log('本机提交已过期、不兼容或无有效池内数据，保留现有结果');process.exit(0)}
await writeFile(new URL('pool-signals.json.tmp',root),JSON.stringify(updated));await rename(new URL('pool-signals.json.tmp',root),file);console.log('已合并本机结果：'+updated.local_update.coverage+'/'+pool.stocks.length+'只；非全池完成');
