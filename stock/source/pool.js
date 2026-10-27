import {api} from './integrations.js';
import {validatePool,filterPool,displayPoolROE} from './pool-model.js';
export async function mountPool({esc,download,onSelect}){
 const root=document.querySelector('#roe-pool');if(!root)return;let pool=null,page=0,updating=false;const size=30;
 root.innerHTML=`<div class="sectionhead"><div><span class="eyebrow">年度基本面股票池</span><h2>2025 年 ROE &gt; 10%</h2></div><button id="poolrefresh">更新来源数据</button></div><p>按2025年年报加权平均ROE筛选，沪深北A股均纳入，保留ST及所有行业。ROE恰好10%不入池。</p><p id="poolstatus" class="small" role="status">正在读取已核验股票池…</p><div id="poolsummary"></div><div class="poolcontrols"><label>搜索股票或行业<input id="poolsearch" placeholder="代码、名称、行业" type="search"></label><label>市场<select id="poolexchange"><option value="all">全部A股</option><option value="SH">沪市</option><option value="SZ">深市</option><option value="BJ">北交所</option></select></label><label>排序<select id="poolsort"><option value="roe">ROE从高到低</option><option value="code">代码从小到大</option></select></label></div><div class="actions"><button id="poolexport" disabled>导出全池 CSV</button><span id="poolcount" class="small"></span></div><div id="poolrows"></div><div class="actions poolpages"><button id="poolprev">上一页</button><span id="poolpage" class="small"></span><button id="poolnext">下一页</button></div><details><summary>数据口径与覆盖范围</summary><p id="poolcoverage"></p><p>股票池使用2025年年报；点击分析后读取的是最新可得财报，两者报告期可能不同。高ROE可能受非经常性损益或净资产规模影响，达标不等于当前买入信号。</p></details>`;
 const $=id=>root.querySelector(id),status=(text,bad=false)=>{$('#poolstatus').textContent=text;$('#poolstatus').className=bad?'error':'small'};
 function render(){if(!pool)return;const rows=filterPool(pool.stocks,$('#poolsearch').value,$('#poolexchange').value,$('#poolsort').value),total=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,total-1);
  $('#poolcount').textContent=`全池 ${pool.stocks.length} 只 · 当前筛选 ${rows.length} 只`;
  $('#poolrows').innerHTML=rows.slice(page*size,(page+1)*size).map(s=>`<article class="poolrow"><button class="poolselect" data-pool-code="${s.code}"><strong>${esc(s.name)}</strong><span>${s.code} · 查看结论 →</span></button><div class="poolroe"><strong>${esc(displayPoolROE(s.roe))}%</strong><span>2025年ROE</span></div><p>${esc(s.market)} · ${esc(s.industry)} · 公告 ${esc(s.notice_date||'缺失')}</p></article>`).join('')||'<p class="small">没有匹配的股票。</p>';
  $('#poolpage').textContent=`第 ${page+1} / ${total} 页`;$('#poolprev').disabled=page===0;$('#poolnext').disabled=page+1>=total;
  root.querySelectorAll('[data-pool-code]').forEach(b=>b.onclick=()=>{const stock=pool.stocks.find(s=>s.code===b.dataset.poolCode);if(stock)onSelect(stock)});
 }
 function accept(data){pool=validatePool(data);page=0;const s=pool.stats;
  $('#poolsummary').innerHTML=`<div class="cards"><div class="stat">ROE严格大于10%<strong>${s.qualified}</strong>只股票</div><div class="stat">来源年报覆盖<strong>${s.covered_a_shares}</strong>只A股</div><div class="stat">ROE数据缺失<strong>${s.missing_roe}</strong>只，未当作不达标</div></div>`;
  $('#poolcoverage').textContent=`${pool.coverage} 已核对 ${s.source_pages} 页、${s.source_records} 条来源记录；ROE≤10%有 ${s.not_above_threshold} 只，来源范围外 ${s.outside_scope} 条，未到公告日 ${s.future_notice} 条，公告日缺失 ${s.missing_notice} 条。来源：${pool.source}。`;
  $('#poolexport').disabled=false;render();status('核验抓取时间：'+new Date(pool.as_of).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）；全部分页已完整核对。');
 }
 for(const id of ['#poolsearch','#poolexchange','#poolsort'])$(id).addEventListener('input',()=>{page=0;render()});
 $('#poolprev').onclick=()=>{if(page>0){page--;render()}};$('#poolnext').onclick=()=>{page++;render()};
 const cell=x=>{let value=String(x??'');if(/^[=+@\-]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"'};
 $('#poolexport').onclick=()=>{if(!pool)return;const rows=[['代码','名称','2025年加权平均ROE(%)','行业','市场','报告期','公告日期'],...pool.stocks.map(s=>[s.code,s.name,s.roe,s.industry,s.market,s.report_date,s.notice_date])];download('roe-2025-gt10.csv','\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8')};
 $('#poolrefresh').onclick=async()=>{if(updating)return;updating=true;$('#poolrefresh').disabled=true;status('正在完整读取年报分页，现有股票池仍可使用…');try{const data=await api('/api/roe-pool?refresh=1',{onProgress:(current,total)=>status(`正在读取第 ${current} / ${total} 页；完成核验后才替换原股票池。`)});accept(data)}catch(e){status('更新失败：'+e.message+'。'+(pool?'保留现有股票池（抓取于 '+pool.as_of+'）。':'尚无可验证股票池。'),true)}finally{updating=false;$('#poolrefresh').disabled=false}};
 try{let data=JSON.parse(document.querySelector('#roe-pool-data')?.textContent||'{}');if(!data.complete){const response=await fetch(new URL('pool-2025.json',import.meta.url));if(!response.ok)throw Error('无法读取股票池快照');data=await response.json()}accept(data)}catch(e){status('股票池未加载：'+e.message,true)}
}
