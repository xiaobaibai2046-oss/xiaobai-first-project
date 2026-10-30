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
 return {packet:{schema_version:1,rule:SIGNAL_RULE,run_id:randomUUID(),generated_at:now.toISOString(),scope:'600809单股连接验证，非全池',results:{[record.code]:record}},summary};
}
function gh(args){const p=spawnSync('gh',args,{encoding:'utf8',windowsHide:true});if(p.error)throw Error('无法启动GitHub CLI，请完成安装配置');if(p.status!==0)throw Error('GitHub授权或API请求失败，请查看本机GitHub CLI状态（不会打印令牌）');return p.stdout}
async function publish(file){
 const packet=JSON.parse(await readFile(file,'utf8'));const path='repos/xiaobaibai2046-oss/xiaobai-first-project/contents/stock/source/local-signals.json';
 if(gh(['api','repos/xiaobaibai2046-oss/xiaobai-first-project','--jq','.permissions.push']).trim()!=='true')throw Error('GitHub账号没有目标仓库写入权限');
 let commit;
 for(let attempt=0;attempt<3;attempt++){
  let sha;try{sha=JSON.parse(gh(['api',path])).sha}catch{ /* first creation; PUT still checks permissions */ }
  const payload={message:'Update Dazhihui local analysis '+packet.generated_at,content:Buffer.from(JSON.stringify(packet)).toString('base64'),branch:'main',...(sha?{sha}:{})};
  const body=file+'.upload.json';await writeFile(body,JSON.stringify(payload));
  try{commit=JSON.parse(gh(['api','--method','PUT',path,'--input',body])).commit.sha;break}catch(e){if(attempt===2)throw e}
 }
 console.log('已提交分析结果，等待网站部署；提交：'+commit);
 for(let i=0;i<40;i++){
  try{const r=await fetch('https://xiaobaibai2046-oss.github.io/xiaobai-first-project/stock/pool-signals.json?v='+Date.now(),{signal:AbortSignal.timeout(10000)});const data=await r.json();if(data.local_update?.run_id===packet.run_id){console.log('网站更新已确认：'+data.local_update.applied_at);return}}catch{}
  await new Promise(r=>setTimeout(r,15000));
 }
 throw Error('结果已提交，但10分钟内未确认网站部署；请查看GitHub Actions，不能视为网站更新完成');
}
async function main(){const [command,...args]=process.argv.slice(2);
 if(command==='publish'){await publish(args[0]);return}
 const [day,minute,output]=args;if(!day||!minute)throw Error('缺少日线和5分钟文件路径');const d=await readFile(day),m=await readFile(minute);
 if(command==='check'){const p=validatePair(d,m);console.log('数据完整：'+p.daily.last_date+'；当天日线、4根60分钟及成交量一致');return}
 if(command!=='analyze'||!output)throw Error('命令须为check、analyze或publish');
 const {packet,summary}=await analyzePair(d,m);await writeFile(output,JSON.stringify(packet));await writeFile(output+'.analysis.json',JSON.stringify(summary,null,2));console.log('分析完成：'+packet.scope+'；分类 '+packet.results['600809'].state+'。财务或报价失败不会以模拟值补齐。');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
