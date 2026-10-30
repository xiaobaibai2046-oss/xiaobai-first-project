// Dazhihui text exports only. This does not connect to a desktop process or SDK.
const datasets=new Map();
export function parseDzhText(text,{now=new Date(),skipInvalid=false}={}){
 const lines=String(text).replace(/^\uFEFF/,'').trim().split(/\r?\n/);const title=lines.shift()||'';
 const code=title.match(/(?:^|['"\s])(\d{6})(?=['"\s]|$)/)?.[1];
 if(!code||!/^(60|68|00|30|43|83|87|92)/.test(code))throw Error('文件首行须包含六位A股代码');
 const kind=/60\s*分钟/.test(title)?'hourly':/日线/.test(title)?'history':null;if(!kind)throw Error('仅支持大智慧日线或60分钟文本导出');
 const name=title.replace(/['"]/g,'').split(/\t+/)[1]?.trim()||code;
 const headers=(lines.shift()||'').split('\t').map(s=>s.trim());const keys=['日期','开盘','最高','最低','收盘','成交量'];const columns=keys.map(k=>headers.indexOf(k));if(columns.some(i=>i<0))throw Error('缺少日期、开盘、最高、最低、收盘或成交量列；请导出制表符分隔的文本');
 const clock=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});const p=Object.fromEntries(clock.formatToParts(now).map(x=>[x.type,x.value]));const today=`${p.year}-${p.month}-${p.day}`;
 const bars=[],issues=[],seen=new Set();let unfinished=0;
 for(const [i,line] of lines.entries()){
  if(!line.trim())continue;const row=line.split('\t'),raw=columns.map(j=>row[j]?.trim());
  try{
   const m=raw[0]?.match(/^(\d{2}|\d{4})[\/-](\d{2})[\/-](\d{2})(?:\s+(\d{2}:\d{2}))?$/);if(!m)throw Error('日期格式无效');
   const date=`${m[1].length===2?'20'+m[1]:m[1]}-${m[2]}-${m[3]}`;if(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('日期无效');
   if(kind==='hourly'&&!['10:30','11:30','14:00','15:00'].includes(m[4]))throw Error('60分钟收盘时间须为10:30、11:30、14:00或15:00');
   if(kind==='history'&&m[4])throw Error('日线不能含小时分钟，请检查周期');
   const stamp=kind==='hourly'?date+'T'+m[4]+':00+08:00':date;
   if(seen.has(stamp))throw Error('重复K线时间');seen.add(stamp);
   if(raw.slice(1).some(x=>!x||!/^[+\-]?\d+(?:\.\d+)?$/.test(x)))throw Error('价格或成交量缺失／格式无效');
   const [open,high,low,close,volume]=raw.slice(1).map(Number);if([open,high,low,close,volume].some(x=>!Number.isFinite(x))||Math.min(open,high,low,close)<=0||volume<0||high<Math.max(open,close)||low>Math.min(open,close))throw Error('价格关系异常（最高价不得低于收盘等）或成交量无效');
   if(kind==='hourly'?Date.parse(stamp)>now.getTime():date>today||date===today&&+p.hour<16){unfinished++;continue}
   bars.push({code,name,...(kind==='hourly'?{endTime:stamp}:{date}),open,high,low,close,volume});
  }catch(e){issues.push({line:i+3,message:e.message})}
 }
 if(issues.length&&!skipInvalid)throw Error(`发现${issues.length}行异常：第${issues[0].line}行${issues[0].message}。请修正原文件，或勾选明确跳过异常行后重新导入`);
 if(!bars.length)throw Error('没有有效的已完成K线');bars.sort((a,b)=>(a.endTime||a.date).localeCompare(b.endTime||b.date));
 return {code,name,kind,bars,adjustment:'none',source:'大智慧手动导出文件 · 用户确认不复权（非实时接口）',fetched_at:now.toISOString(),...(kind==='hourly'?{timeframe:'60m',last_time:bars.at(-1).endTime}:{first_date:bars[0].date,last_date:bars.at(-1).date}),import_report:{valid:bars.length,unfinished,issues,volume_unit:'导出原值，单位待与大智慧设置核对'}};
}
export function setDzhData(data){datasets.set(data.kind+':'+data.code,data)}
export function clearDzhData(){datasets.clear()}
export function getDzhData(path){const u=new URL(path,'https://local.invalid');const kind=u.pathname==='/api/history'?'history':u.pathname==='/api/hourly'?'hourly':null;return kind?datasets.get(kind+':'+u.searchParams.get('code'))||null:null}
export function mountDzhImport(){
 const root=document.querySelector('#dzh-import');if(!root)return;
 root.innerHTML=`<details><summary>接入大智慧导出文件（试运行）</summary><p>选择大智慧导出的日线和／或60分钟TXT文件。导入后该股票优先使用文件K线；未导入的周期、报价和财务仍读取公开接口。文件仅在本次页面打开期间使用，不上传、不自动刷新、不跨设备同步。</p><label>文本编码<select id="dzhencoding"><option value="utf-8">UTF-8（含聊天粘贴保存的文本）</option><option value="gb18030">GB18030／ANSI（中文Windows导出）</option></select></label><label>选择文件（可多选）<input id="dzhfiles" type="file" accept=".txt,.tsv" multiple></label><label><input id="dzhunadjusted" type="checkbox">我已确认这些文件来自不复权图表</label><label><input id="dzhskip" type="checkbox">允许跳过异常行，并在下方列出明细</label><div class="actions"><button id="dzhload" type="button">载入文件</button><button id="dzhclear" type="button">清除已导入行情</button></div><p id="dzhstatus" class="small" role="status">尚未载入大智慧文件；尚未建立大智慧实时连接。</p></details>`;
 if(location.hash==='#dzh-import')root.querySelector('details').open=true;
 const $=id=>root.querySelector(id);let generation=0;
 $('#dzhload').onclick=async()=>{const run=++generation;$('#dzhload').disabled=true;try{
  if(!$('#dzhunadjusted').checked)throw Error('请先在大智慧确认复权设置，再勾选“不复权”');
  const encoding=$('#dzhencoding').value,skipInvalid=$('#dzhskip').checked;const files=[...$('#dzhfiles').files];if(!files.length)throw Error('请选择导出的TXT或TSV文件');if(files.length>20)throw Error('每次最多20个文件');
  const loaded=[];for(const f of files){if(f.size>8*1024*1024)throw Error('单文件不能超过8MB');const bytes=await f.arrayBuffer();const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);loaded.push(parseDzhText(text,{skipInvalid}))}
  if(run!==generation)return;
  const duplicate=new Set();for(const d of loaded){const key=d.code+':'+d.kind;if(duplicate.has(key))throw Error('同一股票周期一次只能载入一个文件');duplicate.add(key)}
  for(const d of loaded)setDzhData(d);
  $('#dzhstatus').textContent=loaded.map(d=>`${d.code} ${d.name} ${d.kind==='hourly'?'60分钟':'日线'}：${d.bars.length}根，截至${d.last_time||d.last_date}；未完成${d.import_report.unfinished}根；跳过异常${d.import_report.issues.length}行。${d.import_report.issues.map(x=>'第'+x.line+'行：'+x.message).join('；')}`).join('\n')+' 请点击“一键分析”重新计算；旧结论不会自动改写。';
  const input=document.querySelector('#quickcode');input.value=loaded[0].code;input.dispatchEvent(new Event('input',{bubbles:true}));
 }catch(e){if(run===generation)$('#dzhstatus').textContent='未导入：'+e.message+'。此前已成功导入的数据仍保留。'}finally{if(run===generation)$('#dzhload').disabled=false}};
 $('#dzhclear').onclick=()=>{generation++;clearDzhData();$('#dzhload').disabled=false;$('#dzhstatus').textContent='已清除本次页面的大智慧文件，下次分析恢复读取公开接口；股票池已缓存的历史检查结果保留。';const input=document.querySelector('#quickcode');input.dispatchEvent(new Event('input',{bubbles:true}))};
}
