import {fixedStats,generateFixed} from './fixed.mjs';
export function initFixedPlan({getDraws,saveDraft}){
  const F=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');let generated=null;
  function info(text){F('fixed-status').textContent=text;}
  function render(){
    const count=Number(F('fixed-count').value);
    try{
      const s=fixedStats(count);F('fixed-generate').disabled=false;
      F('fixed-cost').textContent=`${s.count}组不同六红 × 每组1蓝＝${s.tickets}注，共${s.cost}元。候选池始终为969种。\n仅当“第三区缺席＋10、11、12同时出现”都成立时：至少中一次一等奖或二等奖 ${(100*s.conditionalTopTwo).toFixed(4)}%；一等奖单独 ${(100*s.conditionalFirst).toFixed(4)}%。\n开奖前不假定上述条件：一或二等奖 ${(100*s.overallTopTwo).toFixed(6)}%；一等奖 ${(100*s.overallFirst).toFixed(6)}%。默认97组达到的10.01%仅是条件概率。`;
    }catch(e){F('fixed-generate').disabled=true;F('fixed-cost').textContent=e.message;}
    F('fixed-export').disabled=!generated;F('fixed-save').disabled=!generated||!getDraws().length;
    F('fixed-results').replaceChildren();
    if(!generated)return;
    generated.groups.forEach((red,i)=>{
      const card=document.createElement('article');card.className='combo';
      const label=document.createElement('span');label.className='combo-index';label.textContent=`第${i+1}注 · 固定10/11/12 · 2元`;
      const numbers=document.createElement('div');numbers.className='balls';
      for(const n of red){const b=document.createElement('span');b.className='ball';b.textContent=pad(n);numbers.append(b);}
      const blue=document.createElement('span');blue.className='ball blue';blue.textContent=pad(generated.blues[i]);
      const caption=document.createElement('small');caption.textContent='六红＋单个蓝球；附加的3个红球来自其余19个号码。';
      const blueWrap=document.createElement('span');blueWrap.className='fixed-blue';blueWrap.append(blue);card.append(label,numbers,blueWrap,caption);F('fixed-results').append(card);
    });
  }
  function refresh(){generated=null;render();info('此模式研究预设场景，不要求历史遗漏触发；不会排除已开过的组合，也不强制冷热号。生成后可在本区登记，记录会保存到统一账本。');}
  F('fixed-count').oninput=()=>{generated=null;render();};
  F('fixed-generate').onclick=()=>{try{generated=generateFixed(Number(F('fixed-count').value));render();info(`已从969种候选中抽取${generated.groups.length}组不同六红，并为每组锁定一个随机蓝球。重新生成会替换未保存结果；已保存记录不会变化。`);}catch(e){generated=null;render();info(e.message);}};
  F('fixed-export').onclick=()=>{
    if(!generated)return;
    const csv=['red1,red2,red3,red4,red5,red6,blue,cost,scheme',...generated.groups.map((r,i)=>[...r.map(pad),pad(generated.blues[i]),2,'fixed-triple-hypothesis-v1'].join(','))].join('\n');
    const u=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='固定10-11-12单蓝方案.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  };
  F('fixed-save').onclick=()=>{
    try{
      if(!generated)throw new Error('请先生成组合');
      const value=F('fixed-cutoff').value;if(!value)throw new Error('请填写本期官方销售截止时间（北京时间）');
      saveDraft({draws:getDraws(),groups:generated.groups,blues:generated.blues,zone:2,blueMode:'single',excludeHistory:false,selection:null,scheme:'fixed-triple',target:F('fixed-target').value.trim(),cutoff:value+':00+08:00',mode:F('fixed-mode').value});
      info('已保存到统一账本，并锁定同预算随机对照。此方案单独汇总；开奖结果不满足预设条件时，仍保留该期成本和结果。');
    }catch(e){info('未保存：'+e.message);}
  };
  return {refresh};
}
