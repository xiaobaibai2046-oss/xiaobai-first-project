export const POOL_SOURCE={year:2025,date:'2025-12-31',threshold:10,pageSize:500,filter:'(REPORTDATE=\'2025-12-31\')(SECURITY_TYPE_CODE="058001001")',columns:'SECURITY_CODE,SECURITY_NAME_ABBR,SECUCODE,SECURITY_TYPE_CODE,TRADE_MARKET,REPORTDATE,NOTICE_DATE,UPDATE_DATE,WEIGHTAVG_ROE,PUBLISHNAME'};
export function parsePoolPage(payload,pageSize=500){
 const r=payload?.result;if(payload?.success===false||!r||!Array.isArray(r.data)||!Number.isInteger(r.count)||r.count<=0||!Number.isInteger(r.pages)||r.pages!==Math.ceil(r.count/pageSize)||r.pages>50)throw Error('年报分页数量或数据不完整');return {count:r.count,pages:r.pages,rows:r.data};
}
export function assemblePool(pages,now=new Date(),pageSize=500){
 const first=pages[0];if(!first||pages.length!==first.pages||pages.some((p,i)=>p.count!==first.count||p.pages!==first.pages||p.rows.length!==(i<first.pages-1?pageSize:first.count-pageSize*i)))throw Error('年报分页缺失或总数变化，保留原股票池');
 const stats={source_records:pages.reduce((n,p)=>n+p.rows.length,0),source_pages:pages.length,covered_a_shares:0,qualified:0,missing_roe:0,not_above_threshold:0,outside_scope:0,future_notice:0,missing_notice:0,by_market:{}},stocks=[],seen=new Set();
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));const today=parts.year+'-'+parts.month+'-'+parts.day;
 for(const row of pages.flatMap(p=>p.rows)){
  if(String(row.REPORTDATE||'').slice(0,10)!==POOL_SOURCE.date||row.SECURITY_TYPE_CODE!=='058001001')throw Error('来源混入非2025年报或非A股记录，停止更新');
  const code=String(row.SECURITY_CODE||''),secu=String(row.SECUCODE||'');if(!/^\d{6}$/.test(code)||![code+'.SH',code+'.SZ',code+'.BJ'].includes(secu)){stats.outside_scope++;continue}
  if(seen.has(code))throw Error('年报出现重复股票代码，无法确认全量抓取');seen.add(code);
  if(typeof row.SECURITY_NAME_ABBR!=='string'||!row.SECURITY_NAME_ABBR)throw Error('股票名称缺失');
  const notice=String(row.NOTICE_DATE||'').slice(0,10);if(notice&&(!/^\d{4}-\d{2}-\d{2}$/.test(notice)||!Number.isFinite(Date.parse(notice))||new Date(notice).toISOString().slice(0,10)!==notice))throw Error('公告日期异常');
  if(notice>today){stats.future_notice++;continue}if(!notice)stats.missing_notice++;
  const market=row.TRADE_MARKET||secu.slice(-2);stats.covered_a_shares++;stats.by_market[market]=(stats.by_market[market]||0)+1;
  const raw=row.WEIGHTAVG_ROE,roe=raw==null||raw===''||raw==='-'||raw==='--'||typeof raw==='boolean'?null:Number(raw);
  if(roe===null||!Number.isFinite(roe)){stats.missing_roe++;continue}if(roe<=10){stats.not_above_threshold++;continue}
  stocks.push({code,name:row.SECURITY_NAME_ABBR,roe,report_date:POOL_SOURCE.date,notice_date:notice||null,market,exchange:secu.slice(-2),industry:row.PUBLISHNAME||'未提供'});
 }
 stocks.sort((a,b)=>b.roe-a.roe||a.code.localeCompare(b.code));stats.qualified=stocks.length;
 if(stats.covered_a_shares!==stocks.length+stats.missing_roe+stats.not_above_threshold)throw Error('股票池数量核对失败');
 return {schema_version:1,year:2025,report_date:POOL_SOURCE.date,threshold:10,comparison:'>',roe_metric:'2025年年报加权平均净资产收益率（%）',complete:true,as_of:now.toISOString(),source:'东方财富数据中心 · RPT_LICO_FN_CPD',source_url:'https://datacenter-web.eastmoney.com/api/data/v1/get',source_filter:POOL_SOURCE.filter,coverage:'来源覆盖的沪深北A股2025年年报；不额外排除ST、行业或板块。未披露或来源未覆盖的公司数量不能由本年报表推定，未核验当前上市状态。',stats,stocks};
}
export function validatePool(data){
 if(!data||data.schema_version!==1||data.year!==2025||data.report_date!=='2025-12-31'||data.threshold!==10||data.comparison!=='>'||data.complete!==true||!Number.isFinite(Date.parse(data.as_of))||!Array.isArray(data.stocks)||!data.stats||data.stocks.length!==data.stats.qualified)throw Error('股票池快照未经完整核验');
 const seen=new Set();for(const s of data.stocks){if(!/^\d{6}$/.test(s.code)||!s.name||typeof s.roe!=='number'||!Number.isFinite(s.roe)||s.roe<=10||s.report_date!=='2025-12-31'||!['SH','SZ','BJ'].includes(s.exchange)||seen.has(s.code))throw Error('股票池含重复代码、错误年度或不达标ROE');seen.add(s.code)}
 if(data.stats.covered_a_shares!==data.stats.qualified+data.stats.missing_roe+data.stats.not_above_threshold||data.stats.source_records!==data.stats.covered_a_shares+data.stats.outside_scope+data.stats.future_notice)throw Error('股票池统计与覆盖数量不一致');return data;
}
export function displayPoolROE(roe){return roe>10&&roe.toFixed(2)==='10.00'?String(roe):roe.toFixed(2)}
export function filterPool(stocks,query='',exchange='all',sort='roe'){
 const key=query.trim().toLocaleLowerCase();return stocks.filter(s=>(exchange==='all'||s.exchange===exchange)&&(!key||[s.code,s.name,s.industry,s.market].some(x=>String(x).toLocaleLowerCase().includes(key)))).sort(sort==='code'?(a,b)=>a.code.localeCompare(b.code):(a,b)=>b.roe-a.roe||a.code.localeCompare(b.code));
}
