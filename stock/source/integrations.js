import {backtest,financialAnalysis} from './research.js';
import {browserAPI} from './providers.js';
const $=s=>document.querySelector(s);
const money=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:2}):'缺失';
const pct=n=>n==null?'—':(n*100).toFixed(2)+'%';
export const marketPanel=()=>`<div class="subpanel"><div class="sectionhead"><h3>联网行情与日线</h3><span class="pill">观察列表 · 每次最多 20 只</span></div><label>六位 A 股代码，用逗号分隔<input id="watchcodes" value="600519,000001,600036" placeholder="600519,000001"></label><div class="actions"><button id="quotes" class="primary">获取最新报价</button><button id="history">载入已完成日线并筛选</button><label class="inline"><input type="checkbox" id="poll">每 30 秒刷新报价</label></div><p class="small">报价、已完成日线分别显示日期，盘中报价不混入收盘策略。公开接口可能延迟或中断；当前未提供全市场扫描。</p><div id="marketstatus" role="status"></div><div id="quotesview"></div></div>`;
export const financePanel=()=>`<div class="subpanel"><h3>自动财务分析</h3><div class="actions"><button id="financial" class="primary">获取该股票财务摘要</button><button id="financeexport" disabled>导出财务 JSON</button></div><p class="small">使用上方研究对象的六位代码。分析累计报表，不把季度累计值当作全年值；缺失数据不按零处理。</p><div id="financestatus" role="status"></div><div id="financeview"></div></div>`;
export const backtestPanel=()=>`<div class="subpanel"><h3>历史回测 · MA20日线基准（未含60分钟MACD）</h3><p>策略：收盘价 ＞ MA20时生成买入信号；收盘低于 MA20或入场价减 2×ATR 时生成卖出信号。信号在下一交易日开盘尝试成交。</p><div class="grid"><label>已导入股票<select id="btcode"></select></label><label>初始资金（元）<input id="btcapital" type="number" value="100000"></label><label>单笔风险（%）<input id="btrisk" type="number" value="0.5" step="0.1"></label><label>趋势均线<input value="MA20（日线）" readonly></label><label>佣金（万分之）<input id="btcommission" type="number" value="3" step="0.1"></label><label>最低单次佣金（元）<input id="btminimum" type="number" value="5"></label><label>单边滑点（万分之）<input id="btslippage" type="number" value="5" step="0.1"></label><label>保守开盘过滤幅度（%，≤4.8）<input id="btguard" type="number" value="4.8" step="0.1"></label><label>开始日期（留空使用可用区间）<input id="btstart" type="date"></label><label>结束日期（留空使用末日）<input id="btend" type="date"></label></div><div class="notice">仅普通沪深主板、100 股整手。缺少公司行动及历史 ST/新股状态；不复权数据在除权窗口可能失真。尚非全市场、全收益或可直接实盘执行的回测。</div><div class="actions"><button id="runbacktest" class="primary">运行回测</button><button id="btexport" disabled>导出完整回测 JSON</button></div><div id="btstatus" role="status"></div><div id="btview"></div></div>`;
export async function api(path,options={}){if(document.querySelector('meta[name="data-transport"]')?.content==='browser')return browserAPI(path,options);const control=new AbortController(),timer=setTimeout(()=>control.abort(),25000);try{const response=await fetch(path,{signal:control.signal});let data;try{data=await response.json()}catch{throw Error('API 服务不可用，请使用新版 npm start 启动 Python 后端')}if(!response.ok||data.error)throw Error(data.error||'数据请求失败');return data}catch(e){if(e.name==='AbortError')throw Error('请求超过 25 秒，请稍后重试');throw e}finally{clearTimeout(timer)}}
export function mountIntegrations(context){
 const {esc,store,download,getGroups,getDataInfo,onHistory,getSubject}=context;
 let disposed=false,timer=null,quoteBusy=false,historyBusy=false,financeData=null,testResult=null;
 const status=(id,text,bad=false)=>{if(disposed||!$(id))return;$(id).className=bad?'error':'small';$(id).textContent=text};
 function codes(){const values=[...new Set($('#watchcodes').value.split(/[,，\s]+/).filter(Boolean))];if(!values.length||values.length>20||values.some(x=>!/^\d{6}$/.test(x)))throw Error('请输入 1—20 个六位股票代码');return values}
 if($('#quotes')){
  $('#watchcodes').value=store.watchcodes||'600519,000001,600036';
  $('#watchcodes').onchange=()=>{store.watchcodes=$('#watchcodes').value;try{localStorage.setItem('zhiheng-v1',JSON.stringify(store))}catch{}$('#quotesview').innerHTML='';status('#marketstatus','代码已改变，请刷新报价');};
  const quotes=async()=>{
   if(quoteBusy||disposed)return;quoteBusy=true;$('#quotes').disabled=true;
   try{const requested=codes();status('#marketstatus','正在连接公开报价源…');const data=await api('/api/quotes?codes='+encodeURIComponent(requested.join(',')));if(disposed)return;if(requested.join(',')!==codes().join(','))return;
    $('#quotesview').innerHTML=`<div class="tablewrap"><table><thead><tr>${['股票','最新价','涨跌幅','交易所时间（北京时间）','新鲜度'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${data.quotes.map(q=>`<tr><td>${esc(q.code)} ${esc(q.name)}</td><td>${money(q.price)}</td><td>${q.change_pct==null?'—':money(q.change_pct)+'%'}</td><td>${esc(q.exchange_time)}</td><td>${q.stale?'非新鲜报价（可能已收盘）':'距报价时间 ≤3 分钟；延迟未保证'}</td></tr>`).join('')}</tbody></table></div><p class="small">来源：${esc(data.source)}；抓取：${esc(data.fetched_at)}；${data.cache_hit?'10 秒缓存命中':'本次联网获取'}。公开报价不保证实时性。</p>`;
    status('#marketstatus',data.errors?.length?'部分股票未返回：'+data.errors.map(x=>x.code+' '+x.error).join('；'):'报价已更新',!!data.errors?.length);
   }catch(e){if(!disposed){$('#quotesview').innerHTML='';status('#marketstatus',e.message+'。未显示演示报价。',true)}}finally{quoteBusy=false;if(!disposed)$('#quotes').disabled=false}
  };
  $('#quotes').onclick=quotes;
  $('#poll').onchange=()=>{if(timer)clearInterval(timer);if($('#poll').checked){quotes();timer=setInterval(()=>{if(!document.hidden)quotes()},30000)}};
  $('#history').onclick=async()=>{
   if(historyBusy)return;historyBusy=true;$('#history').disabled=true;
   try{const requested=codes();if(requested.length>8)throw Error('一次日线导入最多 8 只，请分批研究');status('#marketstatus','正在获取最近至多 640 根已完成日线…');
    const all=[];for(let i=0;i<requested.length;i+=2)all.push(...await Promise.all(requested.slice(i,i+2).map(code=>api('/api/history?code='+code))));if(disposed)return;
    if(requested.join(',')!==codes().join(','))throw Error('获取期间代码已改变，请重新载入');
    onHistory(all);status('#marketstatus','日线已载入；不复权，除权窗口回测需人工核查。来源：腾讯财经。');
   }catch(e){status('#marketstatus',e.message+'；原有行情未替换。',true)}finally{historyBusy=false;if(!disposed)$('#history').disabled=false}
  };
 }
 if($('#financial')){
  $('#financial').onclick=async()=>{
   const found=getSubject().match(/^\d{6}/);if(!found){status('#financestatus','请先在上方填写六位代码和股票名称',true);return}
   $('#financial').disabled=true;$('#financeexport').disabled=true;financeData=null;$('#financeview').innerHTML='';status('#financestatus','正在获取已披露财务报表…');
   try{const data=await api('/api/financial?code='+found[0]);if(disposed)return;financeData=data;
    const r=data.reports[0],analysis=financialAnalysis(r);
    $('#financeview').innerHTML=`<div class="notice">${esc(data.source)} · 抓取 ${esc(data.fetched_at)}<br>报告期 ${esc(r.period)} / 公告日 ${esc(r.notice_date||'缺失')}<br>${esc(data.period_basis)}</div><div class="grid">${[['累计营收',r.revenue],['累计归母净利润',r.profit],['每股收益',r.eps]].map(([n,v])=>`<div class="stat">${n}<strong>${money(v)}</strong>${n==='每股收益'?'元/股':'元'}</div>`).join('')}</div>${analysis.messages.map(m=>`<div class="finding ${m.level==='risk'?'riskfinding':''}"><b>${esc(m.title)}</b><p>${esc(m.detail)}</p></div>`).join('')}${analysis.missing.length?`<p class="error">未完成的数据检查：${esc(analysis.missing.join('、'))}</p>`:''}<h4>历史披露摘要（累计口径）</h4><div class="tablewrap"><table><thead><tr><th>报告期</th><th>公告日期</th><th>营收（元）</th><th>归母利润（元）</th><th>ROE（%）</th><th>EPS（元/股）</th></tr></thead><tbody>${data.reports.map(x=>`<tr><td>${esc(x.period)}</td><td>${esc(x.notice_date||'缺失')}</td><td>${money(x.revenue)}</td><td>${money(x.profit)}</td><td>${money(x.roe)}</td><td>${money(x.eps)}</td></tr>`).join('')}</tbody></table></div><p class="small">${data.warnings.map(esc).join('；')}</p>`;
    $('#financeexport').disabled=false;status('#financestatus','规则分析完成；不代表审计或买入结论');
   }catch(e){status('#financestatus',e.message+'。未以模拟财报替代。',true)}finally{if(!disposed)$('#financial').disabled=false}
  };
  $('#financeexport').onclick=()=>{if(financeData)download('financial-'+financeData.code+'.json',JSON.stringify(financeData,null,2),'application/json')};
 }
 if($('#runbacktest')){
  const groups=getGroups();$('#btcode').innerHTML=groups.size?[...groups].map(([code,b])=>`<option value="${esc(code)}">${esc(code)} ${esc(b.at(-1).name)}（${b.length} 日）</option>`).join(''):'<option value="">请先在股票池导入日线</option>';
  $('#btcapital').value=store.capital||100000;$('#btrisk').value=store.risk||.5;
  const invalidate=()=>{testResult=null;$('#btexport').disabled=true;$('#btview').innerHTML='';status('#btstatus','参数已更改，请重新运行')};
  document.querySelectorAll('[id^="bt"] input, input[id^="bt"],select[id^="bt"]').forEach(el=>el.addEventListener('input',invalidate));
  $('#runbacktest').onclick=()=>{try{
   const code=$('#btcode').value;if(!code)throw Error('请先导入日线');if(!/^(60\d{4}|00\d{4})$/.test(code))throw Error('首版回测只支持普通沪深主板，暂不支持科创板、创业板和北交所');
   const bars=groups.get(code);if(/ST|退/i.test(bars.at(-1).name||''))throw Error('首版回测不支持当前名称带 ST 或退市标识的股票');
   testResult=backtest(bars,{capital:+$('#btcapital').value,riskPct:+$('#btrisk').value,maPeriod:20,commissionBps:+$('#btcommission').value,minCommission:+$('#btminimum').value,slippageBps:+$('#btslippage').value,openGuardPct:+$('#btguard').value,start:$('#btstart').value,end:$('#btend').value});
   const r=testResult,info=getDataInfo();r.data={code,...info};
   $('#btview').innerHTML=`<div class="notice">${info.demo?'演示回测：合成行情，不对应真实股票':'数据：'+esc(info.source)} · ${r.start} 至 ${r.end} · ${r.equity.length} 个交易日</div><div class="cards">${[['策略价格收益',pct(r.totalReturn)],['价格基准收益',pct(r.benchmarkReturn)],['最大回撤',pct(r.maxDrawdown)],['已平仓交易',r.closedTrades+' 笔'],['胜率（已平仓）',pct(r.winRate)],['累计显式费用',money(r.totalFees)+' 元']].map(([title,value])=>`<div class="stat">${title}<strong>${value}</strong></div>`).join('')}</div>${equityChart(r)}<p>${r.position?'期末仍持有 '+r.position.quantity+' 股，未强制平仓。':'期末无持仓。'} 被过滤订单 ${r.blockedOrders} 次。${r.closedTrades===0?'没有已平仓交易，不能据此判断策略有效性。':''}</p><h4>成交明细</h4><div class="tablewrap"><table><thead><tr><th>信号日期</th><th>成交日期</th><th>方向</th><th>模拟成交价</th><th>股数</th><th>费用</th></tr></thead><tbody>${r.executions.map(t=>`<tr><td>${t.signalDate}</td><td>${t.date}</td><td>${t.side==='BUY'?'买入':'卖出'}</td><td>${money(t.price)}</td><td>${t.quantity}</td><td>${money(t.fee)}</td></tr>`).join('')||'<tr><td colspan="6">没有成交</td></tr>'}</tbody></table></div><details><summary>方法、费用与限制（请阅读）</summary><p>佣金含最低收费；过户费按 2022-04-29 前后费率分段；卖出印花税按 2023-08-28 前后 0.1% / 0.05% 分段。佣金之外费用按模型单列，请与券商实际收费核对。</p>${r.warnings.map(w=>`<p class="small">${esc(w)}</p>`).join('')}</details>`;
   $('#btexport').disabled=false;status('#btstatus','回测完成。此结果不包含财务选股、分红或样本外检验。');
  }catch(e){invalidate();status('#btstatus',e.message,true)}};
  $('#btexport').onclick=()=>{if(testResult)download('backtest-'+testResult.data.code+'.json',JSON.stringify(testResult,null,2),'application/json')};
 }
 return ()=>{disposed=true;if(timer)clearInterval(timer)};
}
function equityChart(result){const values=result.equity.flatMap(x=>[x.value,x.benchmark]),low=Math.min(...values),high=Math.max(...values),range=high-low||1;
 const points=key=>result.equity.map((x,i)=>`${(40+i/(result.equity.length-1)*820).toFixed(1)},${(220-(x[key]-low)/range*190).toFixed(1)}`).join(' ');
 return `<figure class="chart"><figcaption>资金曲线：<span class="good">● 策略</span>　<span class="muted">● 价格基准</span>（元）</figcaption><svg viewBox="0 0 900 265" role="img" aria-label="策略与价格基准资金曲线"><text x="40" y="18">${money(high)}</text><text x="40" y="240">${money(low)}</text><line x1="40" y1="220" x2="860" y2="220" stroke="#d5ded6"/><polyline points="${points('benchmark')}" fill="none" stroke="#a0aaa3" stroke-width="2"/><polyline points="${points('value')}" fill="none" stroke="#24594c" stroke-width="3"/><text x="40" y="262">${result.start}</text><text x="755" y="262">${result.end}</text></svg></figure>`;
}
