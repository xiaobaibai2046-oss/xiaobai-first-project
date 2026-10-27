import {normalizeHourly} from './macd.js';
// Static hosting transport: provider scripts run in an opaque-origin sandbox.
// They cannot access the parent DOM, research notes or localStorage.
const browserCache=new Map();
export function marketSymbol(code){
 if(!/^\d{6}$/.test(code))throw Error('股票代码须为六位数字');
 if(/^(60|68)/.test(code))return 'sh'+code;
 if(/^(00|30)/.test(code))return 'sz'+code;
 if(/^(43|83|87|92)/.test(code))return 'bj'+code;
 throw Error('暂仅支持沪深北 A 股代码');
}
const providerNumber=x=>x==null||x===''||x==='-'||x==='--'||typeof x==='boolean'?null:Number.isFinite(Number(x))?Number(x):null;
function chinaClock(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:+p.hour}}
function fetchedAt(){return new Date().toISOString()}
function sandboxRequest(url,mode,variable){
 return new Promise((resolve,reject)=>{
  const iframe=document.createElement('iframe'),nonce=crypto.randomUUID();iframe.hidden=true;iframe.setAttribute('sandbox','allow-scripts');iframe.setAttribute('aria-hidden','true');iframe.referrerPolicy='no-referrer';
  let ended=false;const finish=(error,data)=>{if(ended)return;ended=true;clearTimeout(timeout);window.removeEventListener('message',message);iframe.remove();error?reject(Error(error)):resolve(data)};
  const message=event=>{if(event.source!==iframe.contentWindow||event.data?.nonce!==nonce)return;finish(event.data.error,event.data.data)};
  const timeout=setTimeout(()=>finish('手机未能在 20 秒内连接数据源，请检查网络或稍后重试'),20000);window.addEventListener('message',message);
  const config=JSON.stringify({url,mode,variable,nonce}).replace(/</g,'\\u003c');
  iframe.srcdoc=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://qt.gtimg.cn https://ifzq.gtimg.cn https://web.ifzq.gtimg.cn https://datacenter-web.eastmoney.com; connect-src 'none'; img-src 'none'; base-uri 'none'"><script>
  (()=>{const c=${config};let sent=false;const send=(data,error)=>{if(sent)return;sent=true;parent.postMessage({nonce:c.nonce,data,error},'*')};
   if(c.mode==='callback')window[c.variable]=data=>send(data);
   const script=document.createElement('script');script.referrerPolicy='no-referrer';script.charset=c.mode==='quote'?'gb18030':'utf-8';script.src=c.url;
   script.onerror=()=>send(null,'数据源连接失败，未使用演示数据替代');
   script.onload=()=>{if(c.mode==='quote'){const out={};for(const key of c.variable)if(typeof window['v_'+key]==='string')out[key]=window['v_'+key];send(out)}else if(c.mode==='variable'){if(window[c.variable])send(window[c.variable]);else send(null,'日线接口未返回数据')}else if(!sent)send(null,'财务接口未返回有效回调')};document.head.append(script);
  })();<\/script>`;
  document.body.append(iframe);
 });
}
export function normalizeBrowserQuote(text,code){
 const f=String(text||'').split('~');if(f.length<47||f[2]!==code||!/^\d{14}$/.test(f[30]))throw Error('报价字段或时间缺失');
 const t=f[30],stamp=`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}+08:00`,time=Date.parse(stamp);
 const price=providerNumber(f[3]),prev=providerNumber(f[4]);if(!price||price<0||!Number.isFinite(time))throw Error('没有有效最新成交价');
 const age=Math.max(0,Math.floor((Date.now()-time)/1000));return {code,name:f[1],price,previous_close:prev,change_pct:prev>0?(price/prev-1)*100:null,open:providerNumber(f[5]),high:providerNumber(f[33]),low:providerNumber(f[34]),volume_lots:providerNumber(f[6]),amount_10k_cny:providerNumber(f[37]),pe_ttm:providerNumber(f[39]),pb:providerNumber(f[46]),exchange_time:stamp,age_seconds:age,stale:age>180};
}
export function normalizeBrowserHistory(payload,code,clock=chinaClock()){
 const key=marketSymbol(code),obj=payload?.data?.[key],rows=obj?.day;if(payload?.code!==0||!Array.isArray(rows)||!rows.length)throw Error('未返回不复权日线；不会静默改用前复权');
 const seen=new Set(),name=Array.isArray(obj.qt?.[key])?obj.qt[key][1]||code:code;
 const bars=rows.map(row=>{
  if(!Array.isArray(row)||row.length<6)throw Error('日线格式变化');const [date,...values]=row;
  const [open,close,high,low,volume]=values.map(providerNumber);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||[open,close,high,low,volume].some(x=>x==null)||Math.min(open,close,high,low)<=0||volume<0||high<Math.max(open,close)||low>Math.min(open,close)||seen.has(date))throw Error('日线包含无效价格、日期或重复数据');seen.add(date);
  return {code,name,date,open,close,high,low,volume};
 }).filter(b=>b.date<clock.date||b.date===clock.date&&clock.hour>=16).sort((a,b)=>a.date.localeCompare(b.date));
 if(!bars.length)throw Error('没有已完成日线');return {code,name,bars,adjustment:'none',source:'腾讯财经公开日线',first_date:bars[0].date,last_date:bars.at(-1).date};
}
export function normalizeBrowserFinancial(payload,code,today=chinaClock().date){
 if(payload?.success===false||!Array.isArray(payload?.result?.data))throw Error('财务源未返回可用报表');
 const fields={eps:['BASIC_EPS','EPSJB'],revenue:['TOTAL_OPERATE_INCOME'],profit:['PARENT_NETPROFIT'],revenue_yoy:['YSTZ','TOTAL_OPERATE_INCOME_YOY'],profit_yoy:['SJLTZ','PARENT_NETPROFIT_YOY'],roe:['WEIGHTAVG_ROE','WEIGHTAVG_ROEYSTZ','ROEJQ'],bps:['BPS'],ocf_per_share:['MGJYXJJE'],gross_margin:['XSMLL']};
 const reports=payload.result.data.map(row=>{
  if(String(row.SECURITY_CODE)!==code)throw Error('财报股票代码不匹配');const period=String(row.REPORTDATE||row.REPORT_DATE||'').slice(0,10),notice=String(row.NOTICE_DATE||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(period)||!Number.isFinite(Date.parse(period))||new Date(period).toISOString().slice(0,10)!==period||notice&&(!/^\d{4}-\d{2}-\d{2}$/.test(notice)||!Number.isFinite(Date.parse(notice))||new Date(notice).toISOString().slice(0,10)!==notice))throw Error('财报日期缺失或无效');
  const report={code,name:row.SECURITY_NAME_ABBR||code,period,notice_date:notice||null,industry:row.PUBLISHNAME||null};
  for(const [k,aliases] of Object.entries(fields))report[k]=aliases.map(key=>providerNumber(row[key])).find(x=>x!==null)??null;return report;
 }).filter(r=>r.period<=today&&(!r.notice_date||r.notice_date<=today)).sort((a,b)=>b.period.localeCompare(a.period));
 if(!reports.length||!Object.keys(fields).some(k=>reports[0][k]!==null))throw Error('没有可识别的已披露财务数据');
 return {code,reports,source:'东方财富数据中心 · 业绩报表 RPT_LICO_FN_CPD',period_basis:'年初至报告期末累计，非单季度、非 TTM；同比以供应商字段为准',warnings:['摘要不能替代公告及审计；未自动核验负债、关联交易和财务真实性','公告日期缺失时不可当作历史已知数据；修订报表不回填到技术回测']};
}
export async function browserAPI(path){
 const u=new URL(path,location.href),key=u.pathname+'?'+u.searchParams.toString(),old=browserCache.get(key);
 const ttl=u.pathname==='/api/quotes'?10000:u.pathname==='/api/history'?300000:u.pathname==='/api/hourly'?60000:3600000;
 if(old&&Date.now()-old.time<ttl)return {...old.data,cache_hit:true};
 let data;
 if(u.pathname==='/api/quotes'){
  const codes=[...new Set((u.searchParams.get('codes')||'').split(','))];if(codes.length>20)throw Error('每次最多 20 只股票');const symbols=codes.map(marketSymbol);
  const raw=await sandboxRequest('https://qt.gtimg.cn/q='+symbols.join(','),'quote',symbols),quotes=[],errors=[];
  for(const code of codes)try{quotes.push(normalizeBrowserQuote(raw[marketSymbol(code)],code))}catch(e){errors.push({code,error:e.message})}
  if(!quotes.length)throw Error('数据源没有返回有效报价');data={quotes,errors,source:'腾讯财经公开报价 · 手机直连（延迟无保证）'};
 }else if(u.pathname==='/api/history'){
  const code=u.searchParams.get('code'),sym=marketSymbol(code),variable='zh_history_'+crypto.randomUUID().replaceAll('-','');const url=new URL('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get');url.searchParams.set('param',sym+',day,,,640,');url.searchParams.set('_var',variable);
  data=normalizeBrowserHistory(await sandboxRequest(url.href,'variable',variable),code);
 }else if(u.pathname==='/api/hourly'){
  const code=u.searchParams.get('code'),sym=marketSymbol(code),variable='kline_m60';const url=new URL('https://ifzq.gtimg.cn/appstock/app/kline/mkline');url.searchParams.set('param',sym+',m60,,320');url.searchParams.set('_var',variable);data=normalizeHourly(await sandboxRequest(url.href,'variable',variable),code);
 }else if(u.pathname==='/api/financial'){
  const code=u.searchParams.get('code');marketSymbol(code);const callback='zh_finance_'+crypto.randomUUID().replaceAll('-',''),url=new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  for(const [k,v] of Object.entries({reportName:'RPT_LICO_FN_CPD',columns:'ALL',filter:`(SECURITY_CODE="${code}")`,pageNumber:'1',pageSize:'8',sortColumns:'REPORTDATE',sortTypes:'-1',callback}))url.searchParams.set(k,v);
  data=normalizeBrowserFinancial(await sandboxRequest(url.href,'callback',callback),code);
 }else throw Error('静态版没有此数据接口');
 data={...data,fetched_at:fetchedAt(),cache_hit:false};if(browserCache.size>=100)browserCache.delete(browserCache.keys().next().value);browserCache.set(key,{time:Date.now(),data});return data;
}
