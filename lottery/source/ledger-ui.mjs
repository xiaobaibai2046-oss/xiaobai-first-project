import {makeRecord,validateRecord,mergeRecords,assessRecord} from './ledger.mjs';
import {blueModeOf} from './bets.mjs';
export function initLedger({getDraws,getGroups,getZone,getSelection=()=>null,getBlueMode=()=>'all',getBlues=()=>[],getExcludeHistory=()=>true}){
  const L=id=>document.getElementById(id),storageKey='ssq-ledger-v1';
  let records=[],storageBroken=false;
  function message(s){L('ledger-status').textContent=s;}
  try{const raw=localStorage.getItem(storageKey);if(raw)records=mergeRecords([],JSON.parse(raw));}
  catch(e){storageBroken=true;message('原账本无法读取，已停止保存以保护数据：'+e.message+'。请先下载原始备份。');}
  function persist(next){
    if(storageBroken)throw new Error('原账本读取异常，禁止覆盖；请先备份原始数据');
    localStorage.setItem(storageKey,JSON.stringify(next));records=next;
  }
  const format=n=>Number(n).toFixed(2)+'元';
  function output(text,name,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function refresh(){
    const draws=getDraws();if(!draws.length)return;
    L('save-record').disabled=!getGroups().length||storageBroken;
    const proposed=records.map(r=>{const a=assessRecord(r,draws);return a.status==='settled'&&!r.resultDraw?{...r,resultDraw:a.draw}:r;});
    if(proposed.some((r,i)=>r!==records[i]))try{persist(proposed);}catch(e){message('开奖可核算，但快照保存失败：'+e.message);}
    const assessments=records.map(r=>({r,a:assessRecord(r,draws)}));
    const summary=[];
    const strategyKey=r=>`${blueModeOf(r)}/${r.rule.excludeHistory??true}/${r.selection?`${r.selection.runScope}/${r.selection.exactRun}`:'zone-random'}`;
    for(const mode of ['simulation','purchased'])for(const sk of new Set(assessments.filter(x=>x.r.mode===mode).map(x=>strategyKey(x.r)))){
      const subset=assessments.filter(x=>x.r.mode===mode&&strategyKey(x.r)===sk),settled=subset.filter(x=>x.a.status==='settled'),pending=subset.filter(x=>x.a.status==='pending'&&Date.parse(x.r.cutoff)>Date.now()).length,overdue=subset.filter(x=>x.a.status==='pending'&&Date.parse(x.r.cutoff)<=Date.now()).length,conflict=subset.filter(x=>x.a.status==='conflict').length;
      if(!subset.length)continue;
      const totalCost=subset.reduce((s,x)=>s+x.r.cost,0),cost=settled.reduce((s,x)=>s+x.r.cost,0),groups=settled.reduce((s,x)=>s+x.r.groups.length,0);
      const sum=(side,field)=>settled.reduce((s,x)=>s+x.a[side][field],0);
      const uncertain=settled.some(x=>x.a.strategy.unknownPayout||x.a.control.unknownPayout);
      const sample=subset[0].r,ss=sample.selection,label=`${blueModeOf(sample)==='single'?'单蓝分散覆盖':'全包16蓝'} / ${sample.rule.excludeHistory??true?'排历史六红':'允许历史六红'} / `+(ss?`冷热三连号 / ${{zoneHistory:'两区历史排三连号',all:'全历史排三连号',recent50:'近50期排三连号',whole:'只排整组六红'}[ss.runScope]} / ${ss.exactRun?'仅一组三连号':'可额外连号'}`:'基础缺区随机');
      summary.push(`${mode==='simulation'?'模拟验证':'自报已购'} · ${label}：共${subset.length}期，${settled.length}期已核奖、${pending}期待开奖、${overdue}期待补开奖数据、${conflict}期冲突。记录成本${format(totalCost)}；已核奖成本${format(cost)}。`);
      if(settled.length){
        const topIssues=side=>settled.filter(x=>x.a[side].topTwo>0).length;
        summary.push(`策略 / 同预算随机对照：一等奖 ${sum('strategy','first')} / ${sum('control','first')} 注；二等奖 ${sum('strategy','second')} / ${sum('control','second')} 注；一或二等奖至少命中 ${topIssues('strategy')}/${settled.length} / ${topIssues('control')}/${settled.length} 期；六红全中 ${sum('strategy','sixRedGroups')} / ${sum('control','sixRedGroups')} 组。每组六红平均命中 ${(sum('strategy','redTotal')/groups).toFixed(3)} / ${(sum('control','redTotal')/groups).toFixed(3)} 个。`);
        if(uncertain)summary.push(`已知固定奖奖金下限：${format(sum('strategy','knownPayout'))} / ${format(sum('control','knownPayout'))}。含一、二等奖，浮动奖金未知，暂不计算总盈亏或回报率。`);
        else summary.push(`模拟税前奖金：${format(sum('strategy','knownPayout'))} / ${format(sum('control','knownPayout'))}；净收益：${format(sum('strategy','knownPayout')-cost)} / ${format(sum('control','knownPayout')-cost)}；回报率（净收益/成本）：${(100*(sum('strategy','knownPayout')-cost)/cost).toFixed(2)}% / ${(100*(sum('control','knownPayout')-cost)/cost).toFixed(2)}%。`);
      }
    }
    L('ledger-summary').textContent=summary.join('\n')||'暂无记录。先生成组合，填写目标期号和截止时间，再保存。随机对照同时生成并锁定，不会开奖后重抽。';
    L('ledger-records').replaceChildren();
    for(const {r,a} of [...assessments].reverse()){
      const item=document.createElement('details');item.className='ledger-record';
      const bm=blueModeOf(r),blueLabel=bm==='single'?'每组单蓝':'每组16蓝';
      const title=document.createElement('summary');title.textContent=`${r.target}期 · ${r.mode==='simulation'?'模拟':'自报已购'} · ${r.groups.length}组 / ${blueLabel} / ${r.cost}元 · ${a.status==='settled'?'已核奖':a.status==='pending'?(Date.parse(r.cutoff)>Date.now()?'待开奖':'待补开奖数据'):'开奖数据冲突'}`;
      const text=document.createElement('p');text.className='ledger-text';
      const tickets=(groups,blues)=>groups.map((g,i)=>g.map(n=>String(n).padStart(2,'0')).join(' ')+(bm==='single'?` + 蓝${String(blues[i]).padStart(2,'0')}`:' + 蓝01—16')).join('\n');
      const lines=[`保存：${new Date(r.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`,`截止：${new Date(r.cutoff).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}；目标开奖日：${r.targetDate}`,`依据截至${r.source.issue}期，共${r.source.count}期。排除第${r.zone+1}区；当时遗漏${r.rule.current}期，平均间隔${r.rule.mean.toFixed(2)}期。历史六红${r.rule.excludeHistory??true?'排除':'不排除'}。`,`策略号码（${blueLabel}）：\n${tickets(r.groups,r.blues)}`,`随机对照号码（${blueLabel}，仅模拟）：\n${tickets(r.control,r.controlBlues)}`];
      if(r.selection){const s=r.selection;lines.push(`附加规则：最近50期（${s.windowStart}—${s.windowEnd}），热池${s.hot.join(' ')}，冷池${s.cold.join(' ')}；三连号排除范围${{zoneHistory:'所选两区完整历史开奖',all:'全部历史',recent50:'最近50期',whole:'只排除历史整组六红'}[s.runScope]}；${s.exactRun?'恰好一组三连号':'允许额外连号'}。`,...s.roles.map((v,i)=>`第${i+1}组角色：热${v.hot.join('/')}；冷${v.cold}；三连号${v.triple.join('/')}；随机${v.random}`));}
      if(a.status==='settled'){
        lines.push(`开奖：${a.draw.date} · ${a.draw.red.join(' ')} + ${a.draw.blue}`);
        for(const [side,label] of [['strategy','策略'],['control','随机对照']])lines.push(`${label}：一至六等奖注数 [${a[side].levels.join(', ')}]；最高命中${a[side].bestRed}红；${a[side].unknownPayout?'固定奖奖金下限':'模拟税前奖金'}${format(a[side].knownPayout)}。`);
      }else if(a.status==='conflict')lines.push('当前开奖与保存快照或登记日期冲突，不纳入核奖比较。请核对数据，原记录与快照保留。');
      text.textContent=lines.join('\n');item.append(title,text);L('ledger-records').append(item);
    }
  }
  L('save-record').onclick=()=>{
    try{
      if(records.length>=1000)throw new Error('最多保存1000期，请先导出备份');
      const value=L('record-cutoff').value;if(!value)throw new Error('请填写北京时间的记录截止时间');
      const r=makeRecord({draws:getDraws(),groups:getGroups(),zone:getZone(),selection:getSelection(),blueMode:getBlueMode(),blues:getBlues(),excludeHistory:getExcludeHistory(),target:L('record-target').value.trim(),cutoff:value+':00+08:00',mode:L('record-mode').value,records});
      persist([...records,r]);message('已保存此期策略、成本和同注数随机对照。保存后不提供编辑或重抽；请导出备份。');refresh();
    }catch(e){message('未保存：'+e.message);}
  };
  L('export-ledger').onclick=()=>{
    const raw=storageBroken?localStorage.getItem(storageKey):JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2);
    output(raw??'',storageBroken?'账本原始数据.txt':'双色球账本.json','application/json;charset=utf-8');
  };
  L('import-ledger').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('文件不能超过10MB');
      const data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));
      if(data.version!==1)throw new Error('账本版本无效');
      const merged=mergeRecords(records,data.records);persist(merged);message('备份已合并；重复记录跳过，冲突记录不会覆盖。导入内容不构成开奖前独立存证。');refresh();
    }catch(err){message('未导入，原账本保留：'+err.message);}
    e.target.value='';
  };
  return {refresh};
}
