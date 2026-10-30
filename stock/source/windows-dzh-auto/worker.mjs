import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {parseDzhDad} from '../dzh-dad.js';import {expectedSignalTime,signalRecord,SIGNAL_RULE} from '../signal-model.js';import {summarizeStock} from '../conclusion.js';
import {normalizeBrowserQuote,normalizeBrowserFinancial} from '../providers.js';
export function validatePair(dayBytes,minuteBytes,now=new Date()){
 const daily=parseDzhDad(dayBytes,{now}),hourly=parseDzhDad(minuteBytes,{now});
 if(daily.kind!=='history'||hourly.kind!=='hourly'||daily.code!=='600809'||hourly.code!==daily.code)throw Error('本试运行仅支持600809单股的日线及5分钟DAD；未将单股视为全池');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(expectedSignalTime(now,'daily')!==today)throw Error('当前规则等待北京时间16:00后确认当日日线；请稍后自动重试');
 if(daily.last_date!==today||hourly.last_time!==today+'T15:00:00+08:00')throw Error('日线或5分钟文件尚未覆盖当天收盘；保留网站旧结果，等待重试');
 if(daily.bars.length<20||hourly.bars.length<100||hourly.import_report.issues.length||hourly.import_report.incomplete_groups.length)throw Error('数据条数不足、异常或存在不完整60分钟组，停止发布');
 const rows=hourly.bars.filter(b=>b.endTime.startsWith(today));if(rows.length!==4)throw Error('当天必须有4根完整60分钟K线');
 const aggregate={open:rows[0].open,high:Math.max(...rows.map(b=>b.high)),low:Math.min(...rows.map(b=>b.low)),close:rows.at(-1).close,volume:rows.reduce((s,b)=>s+b.volume,0)};
 for(const [k,v] of Object.entries(aggregate))if(Math.abs(v-daily.bars.at(-1)[k])>.005)throw Error('日线与5分钟合成数据不一致：'+k);
 return {daily,hourly};
}
async function supplement(kind,code){
 const timeout=AbortSignal.timeout(20000);
 if(kind==='quote'){
  const r=await fetch('https://qt.gtimg.cn/q=sh'+code,{signal:timeout});if(!r.ok)throw Error('报价HTTP '+r.status);
  const text=new TextDecoder('gb18030').decode(await r.arrayBuffer()),match=text.match(/v_sh600809="([^"]*)"/);if(!match)throw Error('报价格式变化');
  return {quotes:[normalizeBrowserQuote(match[1],code)],source:'腾讯财经公开报价（补充）'};
 }
 const u=new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
 for(const [k,v]of Object.entries({reportName:'RPT_LICO_FN_CPD',columns:'ALL',filter:`(SECURITY_CODE="${code}")`,pageNumber:'1',pageSize:'8',sortColumns:'REPORTDATE',sortTypes:'-1'}))u.searchParams.set(k,v);
 const r=await fetch(u,{signal:timeout});if(!r.ok)throw Error('财报HTTP '+r.status);return normalizeBrowserFinancial(await r.json(),code);
}
export async function analyzePair(dayBytes,minuteBytes,{now=new Date(),request=supplement}={}){
 const {daily,hourly}=validatePair(dayBytes,minuteBytes,now),errors={},values={};
 await Promise.all(['quote','financial'].map(async k=>{try{values[k]=await request(k,daily.code)}catch(e){errors[k]=e.message}}));
 const quote=values.quote?.quotes?.find(q=>q.code===daily.code)||null;
 const summary=summarizeStock({code:daily.code,history:daily,hourly,quote,financial:values.financial,errors,now,includeSimulation:false});
 summary.signalSources={daily:daily.source,hourly:hourly.source,quote:values.quote?.source||null,financial:values.financial?.source||null};
 const record=signalRecord(summary,now);
 return {packet:{schema_version:1,rule:SIGNAL_RULE,run_id:randomUUID(),generated_at:now.toISOString(),mode:'auxiliary',scope:'600809单股辅助连接验证，非全池；不覆盖云端',results:{[record.code]:record}},summary};
}
function gh(args){const p=spawnSync('gh',args,{encoding:'utf8',windowsHide:true});if(p.error)throw Error('无法启动GitHub CLI，请完成安装配置');if(p.status!==0)throw Error('GitHub授权或API请求失败，请查看本机GitHub CLI状态（不会打印令牌）');return p.stdout}
export async function publishAux(file,{callGh=gh,readPublished=async()=>{const r=await fetch('https://raw.githubusercontent.com/xiaobaibai2046-oss/xiaobai-first-project/dzh-aux-data/aux/dzh-signals.json?v='+Date.now(),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('辅助文件尚未可读');return r.json()},pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const packet=JSON.parse(await readFile(file,'utf8'));if(packet.mode!=='auxiliary')throw Error('拒绝发布非辅助数据');const repo='repos/xiaobaibai2046-oss/xiaobai-first-project',branch='dzh-aux-data',path=repo+'/contents/aux/dzh-signals.json';
 if(callGh(['api','repos/xiaobaibai2046-oss/xiaobai-first-project','--jq','.permissions.push']).trim()!=='true')throw Error('GitHub账号没有目标仓库写入权限');
 try{callGh(['api',repo+'/git/ref/heads/'+branch])}catch{
  const ref=JSON.parse(callGh(['api',repo+'/git/ref/heads/main']));const body=file+'.branch.json';await writeFile(body,JSON.stringify({ref:'refs/heads/'+branch,sha:ref.object.sha}));
  try{callGh(['api','--method','POST',repo+'/git/refs','--input',body])}catch{callGh(['api',repo+'/git/ref/heads/'+branch])}
 }
 let commit;
 for(let attempt=0;attempt<3;attempt++){
  let sha;try{sha=JSON.parse(callGh(['api',path+'?ref='+branch])).sha}catch{ /* first creation; PUT still checks permissions */ }
  const payload={message:'Update Dazhihui local analysis '+packet.generated_at,content:Buffer.from(JSON.stringify(packet)).toString('base64'),branch,...(sha?{sha}:{})};
  const body=file+'.upload.json';await writeFile(body,JSON.stringify(payload));
  try{commit=JSON.parse(callGh(['api','--method','PUT',path,'--input',body])).commit.sha;break}catch(e){if(attempt===2)throw e}
 }
 console.log('已提交独立辅助分支，等待公开辅助文件可读取；未修改main或云端股票池。提交：'+commit);
 for(let i=0;i<40;i++){
  try{const data=await readPublished();if(data.mode==='auxiliary'&&data.run_id===packet.run_id){console.log('辅助结果发布已确认：'+data.generated_at+'；云端更新未改动');return}}catch{}
  await pause(15000);
 }
 throw Error('辅助结果已提交，但10分钟内未确认公开文件；不视为辅助更新完成，云端主路径不受影响');
}
async function main(){const [command,...args]=process.argv.slice(2);
 if(command==='publish'){await publishAux(args[0]);return}
 const [day,minute,output]=args;if(!day||!minute)throw Error('缺少日线和5分钟文件路径');const d=await readFile(day),m=await readFile(minute);
 if(command==='check'){const p=validatePair(d,m);console.log('数据完整：'+p.daily.last_date+'；当天日线、4根60分钟及成交量一致');return}
 if(command!=='analyze'||!output)throw Error('命令须为check、analyze或publish');
 const {packet,summary}=await analyzePair(d,m);await writeFile(output,JSON.stringify(packet));await writeFile(output+'.analysis.json',JSON.stringify(summary,null,2));console.log('分析完成：'+packet.scope+'；分类 '+packet.results['600809'].state+'。财务或报价失败不会以模拟值补齐。');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
