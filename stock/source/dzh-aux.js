import {SIGNAL_RULE,mergeSignals,signalState} from './signal-model.js';
export function readDzhAux(packet,now=new Date()){
 if(!packet||packet.mode!=='auxiliary'||packet.schema_version!==1||packet.rule!==SIGNAL_RULE)throw Error('辅助数据版本不兼容或尚未配置');
 if(typeof packet.run_id!=='string'||!/^[a-f0-9-]{16,64}$/.test(packet.run_id)||!Number.isFinite(Date.parse(packet.generated_at))||Date.parse(packet.generated_at)>now.getTime()+60000)throw Error('辅助数据时间或标识无效');
 const valid=mergeSignals({},packet.results,new Set(['600809'])),records=[];
 for(const r of Object.values(valid)){
  if(!Array.isArray(r.reasons)||!r.reasons.every(x=>typeof x==='string')||typeof r.sources?.daily!=='string'||typeof r.sources?.hourly!=='string'||!r.sources.daily.startsWith('大智慧DAD')||!r.sources.hourly.startsWith('大智慧DAD'))throw Error('辅助来源或依据无效');
  if(r.checked_at!==packet.generated_at)throw Error('辅助检查时间不一致');
  records.push({...r,current_state:signalState(r,now)});
 }
 if(!records.length)throw Error('没有已支持股票的有效辅助结果');
 return {generated_at:packet.generated_at,run_id:packet.run_id,records};
}
export function mountDzhAux({esc}){
 const root=document.querySelector('#dzh-aux');if(!root)return;
 root.innerHTML='<details><summary>大智慧辅助结果（独立于云端股票池）</summary><p>云端是主要更新路径。这里仅显示电脑提交的大智慧辅助分析，不写入股票池、不修改云端买卖信号；电脑关闭、上传失败或这里无法读取时，云端照常更新。首轮仅600809，非全池。</p><button type="button" id="dzhauxrefresh">刷新辅助结果</button><p id="dzhauxstatus" class="small" role="status">尚未读取辅助结果，展开后按需加载。</p><div id="dzhauxrows"></div></details>';
 const details=root.querySelector('details'),status=root.querySelector('#dzhauxstatus'),button=root.querySelector('#dzhauxrefresh');let busy=false;
 async function refresh(){if(busy)return;busy=true;button.disabled=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const url='https://raw.githubusercontent.com/xiaobaibai2046-oss/xiaobai-first-project/dzh-aux-data/aux/dzh-signals.json?v='+Date.now();
   const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error(response.status===404?'尚未收到大智慧辅助提交':'辅助文件HTTP '+response.status);
   const text=await response.text();if(text.length>500000)throw Error('辅助数据过大');const data=readDzhAux(JSON.parse(text));
   status.textContent='辅助检查时间：'+new Date(data.generated_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）；仅'+data.records.length+'只。云端股票池未修改。';
   root.querySelector('#dzhauxrows').innerHTML=data.records.map(r=>{const state=r.current_state,label={buy:'辅助买入观察',sell:'辅助卖出观察',none:'辅助条件暂未触发',incomplete:'辅助数据不足',stale:'辅助结果已过期，仅供历史核对',unscanned:'辅助尚未核验'}[state];return `<article class="poolrow signal-${state}"><strong>${esc(r.code)} 山西汾酒</strong><span class="signalbadge signal-${state}">${esc(label)}</span><p>日线 ${esc(r.daily_as_of||'未取得')}；60分钟 ${esc(r.hourly_as_of||'未取得')}。</p><p>${esc(r.reasons.slice(0,8).join('；'))}</p></article>`}).join('');
  }catch(e){status.textContent='辅助结果暂不可用：'+(e.name==='AbortError'?'读取超时':e.message)+'。云端更新不受影响；已有辅助结果保留其原检查时间。'}finally{clearTimeout(timer);busy=false;button.disabled=false}
 }
 button.onclick=refresh;details.addEventListener('toggle',()=>{if(details.open)refresh()});setInterval(()=>{if(details.open)refresh()},60000);
 if(location.hash==='#dzh-aux')details.open=true;
}
