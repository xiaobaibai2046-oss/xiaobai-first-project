import {routeCoverImage} from './route-covers.js';
import {getPreparation} from './preparation.js';
import {restaurantsForStop,restaurantQuery,restaurantSearchSources} from './restaurants.js';
import {createRouteMap} from './route-map.js';
import {getCityGuide,guideQuery,lodgingPreference,comfortHotelSearches} from './recommendations.js';
import {routes,mapUrl,filterRoutes,roadbook,daysLabel,distanceLabel} from './data.js';
const $=s=>document.querySelector(s);
let saved=[];
try {const value=JSON.parse(localStorage.getItem('xiangye-saved')||'[]');if(Array.isArray(value))saved=value.filter(id=>routes.some(r=>r.id===id));}catch{}
const state={region:'all',query:'',duration:'all',savedOnly:false,route:routes[0],stop:0,tab:'sights'};
let toastTimer;
let listReturn=null;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
function link(query,label){return `<a href="${mapUrl(query)}" data-map-query="${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;}
function restaurantLink(query,label){return `<a href="${restaurantSearchSources(query)[0].url}" data-restaurant-query="${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;}
// Keep a visible, selectable address even when a preview blocks popups or clipboard access.
const mapDialog=document.createElement('dialog');
mapDialog.className='map-dialog';
mapDialog.setAttribute('aria-labelledby','mapDialogTitle');
mapDialog.innerHTML=`<div class="dialog-heading"><h3 id="mapDialogTitle">地图与商家查询</h3><button id="closeMap" aria-label="关闭查询窗口">×</button></div><p id="mapQuery"></p><div id="querySources" class="map-options"><a id="openAmap" class="primary" target="_blank" rel="noopener noreferrer">打开高德地图 ↗</a><a id="openBaidu" target="_blank" rel="noopener noreferrer">百度地图备用查询 ↗</a></div><label for="mapAddress">查询地址（可长按或全选复制）</label><input id="mapAddress" readonly><button id="copyMap">复制地址</button><p id="copyStatus" role="status" aria-live="polite"></p><p class="note">若点击后没有打开页面，可能是预览面板限制了外部跳转。请复制地址，粘贴到手机或电脑的浏览器打开；也可直接在地图应用搜索上方关键词。</p>`;
document.body.append(mapDialog);
document.addEventListener('click',e=>{
 const a=e.target.closest('[data-map-query],[data-restaurant-query]');if(!a)return;e.preventDefault();
 const restaurant=!!a.dataset.restaurantQuery,query=decodeURIComponent(restaurant?a.dataset.restaurantQuery:a.dataset.mapQuery);
 const sources=restaurant?restaurantSearchSources(query):[{label:'打开高德地图',url:mapUrl(query)},{label:'百度地图备用查询',url:'https://map.baidu.com/search/'+encodeURIComponent(query)}];
 $('#mapDialogTitle').textContent=restaurant?'多渠道查询餐厅与口碑':'地图与商家查询';$('#mapQuery').textContent=query;
 $('#querySources').innerHTML=sources.map((source,i)=>`<a href="${source.url}" data-source-choice="${i}" target="_blank" rel="noopener noreferrer">${source.label} ↗</a>`).join('');
 $('#mapAddress').value=sources[0].url;$('#copyStatus').textContent='';mapDialog.showModal();
});
$('#querySources').addEventListener('click',e=>{const a=e.target.closest('[data-source-choice]');if(a){$('#mapAddress').value=a.href;$('#copyStatus').textContent='已切换到此查询地址；若新页面未打开，可复制地址到浏览器。';}});
$('#closeMap').addEventListener('click',()=>mapDialog.close());
$('#mapAddress').addEventListener('click',e=>e.target.select());
$('#copyMap').addEventListener('click',async()=>{const input=$('#mapAddress');try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(input.value);$('#copyStatus').textContent='地址已复制，请粘贴到浏览器地址栏打开。';}catch{input.focus();input.select();input.setSelectionRange(0,input.value.length);$('#copyStatus').textContent='自动复制不可用，地址已选中。请长按复制，或按 Ctrl+C / ⌘C。';}});
function renderCards(){const list=filterRoutes(routes,{...state,saved});$('#savedCount').textContent=saved.length;$('#savedToggle').setAttribute('aria-pressed',String(state.savedOnly));$('#savedToggle').classList.toggle('active',state.savedOnly);$('#empty').hidden=list.length>0;$('#routeGrid').innerHTML=list.map(r=>`<article class="card ${state.route.id===r.id?'selected':''}"><div class="card-art route-cover"><img class="route-cover-image" src="${routeCoverImage(r)}" alt="${r.title}，沿途站点与方向示意图" decoding="async"><span class="tag">${r.region} · 自驾灵感</span><button class="save" data-save="${r.id}" aria-label="${saved.includes(r.id)?'取消收藏':'收藏'}${r.title}" aria-pressed="${saved.includes(r.id)}">${saved.includes(r.id)?'♥':'♡'}</button></div><div class="card-body"><h3>${r.title}</h3><p>${r.description}</p><div class="meta"><span>◷ ${daysLabel(r)}</span><span>↝ ${distanceLabel(r)}</span></div><div class="card-bottom"><span class="pill">${r.season}</span><button class="view-route" data-route="${r.id}">查看路书 →</button></div></div></article>`).join('');}
let prepared={};
try{const stored=JSON.parse(localStorage.getItem('xiangye-preparation')||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))for(const r of routes)if(Array.isArray(stored[r.id]))prepared[r.id]=stored[r.id].filter(x=>typeof x==='string');}catch{}
function preparedItems(){return prepared[state.route.id]||[];}
function renderPreparation(){
 const p=getPreparation(state.route),done=new Set(preparedItems()),all=p.groups.flatMap(g=>g.items);const count=all.filter(i=>done.has(i.id)).length;
 $('#routePreparation').innerHTML=`<div class="prep-heading"><div><div class="eyebrow">READY FOR THE ROAD</div><h3>自驾准备与风险防范</h3><p>${p.tags.join(' · ')}</p></div><span id="prepProgress" role="status">已准备 ${count} / ${all.length}</span></div><p class="prep-help">按本线路勾选，保存在当前浏览器。数量请按人数、季节、补给间隔与机动时间调整，勾选不代表已核实通行或适合出发。</p><details class="packing-list" open><summary>物资清单 · 点击展开 / 收起</summary><div class="packing-groups">${p.groups.map(g=>`<div class="packing-group" ${g.title.endsWith('专项')?'data-special-preparation':''}><h4>${g.title}</h4>${g.items.map(i=>`<label class="packing-item"><input type="checkbox" data-supply="${i.id}" ${done.has(i.id)?'checked':''}><span><b>${i.name}</b><small>${i.note}</small></span></label>`).join('')}</div>`).join('')}</div></details><details class="route-risks" open><summary>本线路需要防范的风险 · ${p.risks.length} 项</summary><div class="risk-grid">${p.risks.map(r=>`<article class="risk-card"><h4>${r.title}</h4><p><b>提前防范：</b>${r.prevention}</p><p><b>发生后：</b>${r.action}</p></article>`).join('')}</div></details><p class="emergency-note">紧急联系：报警 110 · 急救 120 · 交通事故报警 122。无信号地区不能保证拨通，需提前确认通讯及救援方案。以上为一般建议，天气、通行与医疗情况以当地实时信息和专业判断为准。</p>`;
}
document.querySelector('.preparation-shortcuts').addEventListener('click',e=>{
 const button=e.target.closest('[data-prep-target]');if(!button)return;
 const key=button.dataset.prepTarget;
 const section=key==='risks'?$('#routePreparation .route-risks'):$('#routePreparation .packing-list');section.open=true;
 let target=section;
 if(key==='special'){const special=$('#routePreparation [data-special-preparation]');if(special)target=special;else toast('本线路以通用清单为主，请结合季节与具体选路补充。');}
 target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
});
$('#routePreparation').addEventListener('change',e=>{const input=e.target.closest('[data-supply]');if(!input)return;const done=new Set(preparedItems());if(input.checked)done.add(input.dataset.supply);else done.delete(input.dataset.supply);prepared[state.route.id]=[...done];const all=getPreparation(state.route).groups.flatMap(g=>g.items);$('#prepProgress').textContent=`已准备 ${all.filter(i=>done.has(i.id)).length} / ${all.length}`;try{localStorage.setItem('xiangye-preparation',JSON.stringify(prepared));}catch{toast('本次勾选有效，但浏览器无法保存；请导出路书备份。');}});
const routeMap=createRouteMap($('#routeMap'),index=>{state.stop=index;renderJourney();});
function renderJourney(){const r=state.route;if($('#routePreparation').dataset.preparationRoute!==r.id){renderPreparation();$('#routePreparation').dataset.preparationRoute=r.id;}routeMap.update(r,state.stop);$('#journeyTitle').textContent=r.title;$('#routeSummary').textContent=`${distanceLabel(r)} · ${daysLabel(r)} · ${r.season} ｜ ${r.warning}`;$('#stops').innerHTML=r.stops.map((s,i)=>`<button class="stop ${i===state.stop?'active':''}" data-stop="${i}" aria-pressed="${i===state.stop}"><span class="stop-num">${String(i+1).padStart(2,'0')}</span><span>${s.name}<small>${s.days}</small></span></button>`).join('');renderDetails();}
function restaurantComparison(stop,guide){
 const restaurants=restaurantsForStop(stop);
 const rows=guide.food.map(food=>{const matched=restaurants.filter(r=>r.dish===food.name);return matched.length?matched.map(r=>`<tr><th scope="row">${r.dish}</th><td><strong>${r.name}</strong><small>${r.status}</small></td><td>${r.strength}</td><td>${r.weakness}</td><td>${restaurantLink(restaurantQuery(guide.location,r),'多渠道查门店与口碑')}</td></tr>`).join(''):`<tr class="restaurant-pending"><th scope="row">${food.name}</th><td>尚无已核验餐厅</td><td>待确认擅长菜品、位置与就餐便利性</td><td>营业、菜单、停车与近期评价待核实</td><td>${restaurantLink(guide.location+' '+food.name+' 餐厅','多渠道找餐厅')}</td></tr>`;}).join('');
 return `<div class="rec-section-title"><h4>对应餐厅与优势劣势对比</h4><span>${restaurants.length?restaurants.length+' 个品牌候选':'门店资料待核验'}</span></div><p class="note">每项菜品对应展示餐厅资料；品牌候选尚未选定具体门店，不是实地探店或实时排名。未经核验的城市不填虚构商家、评分、人均或停车承诺。</p><div class="restaurant-table-wrap" tabindex="0" aria-label="餐厅对比表，可横向滚动"><table class="restaurant-table"><caption>餐厅选择对比：优势、劣势与待核实事项</caption><thead><tr><th scope="col">对应美食</th><th scope="col">餐厅 / 品牌</th><th scope="col">优势与适合场景</th><th scope="col">劣势 / 待核实事项</th><th scope="col">查询</th></tr></thead><tbody>${rows}</tbody></table></div><div class="restaurant-research-note"><b>新的查询路径：先查口碑，再核实门店</b><p>点击“多渠道”可选择大众点评、美团、携程的网页检索或综合搜索。对照同一家门店的地址、近期评价日期、菜单、人均与停车信息，再比较优劣。平台可能需要登录或在 App 中查看；网页检索不等于已获取平台实时评分。</p></div><p class="note">长表可左右滑动。若搜索页面无法打开，可在查询窗口复制地址；本页不会把未读取的评价自动写成比较结论。</p>`;
}
function renderDetails(){
 const s=state.route.stops[state.stop],g=getCityGuide(s);
 $('#stopIntro').innerHTML=`<div class="stop-intro"><div><h3>${s.name}</h3><p>${s.days} · 海拔参考 ${s.altitude}</p></div><div class="map-link">${link(g.location,'地图查看')}</div></div>`;
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.setAttribute('aria-pressed',String(b.dataset.tab===state.tab));});
 const item=(title,text,url)=>`<article class="info"><h4>${title}</h4><p>${text}</p>${url||''}</article>`;
 const cards=(items,label)=>`<div class="recommendation-grid">${items.map((entry,i)=>`<article class="info recommendation" data-kind="${entry.kind}"><div class="rec-heading"><span class="rec-index">${String(i+1).padStart(2,'0')}</span><h4>${entry.name}</h4></div><span class="rec-status">${entry.status||(entry.kind==='dish'?'当地 / 区域菜品 · 非商家排名':'景点 / 沿途看点 · 开放待核实')}</span><p>${entry.reason}</p>${entry.kind==='dish'?restaurantLink(guideQuery(g,entry),label):link(guideQuery(g,entry),label)}</article>`).join('')}</div>`;
 const notice=`<p class="guide-disclaimer">编辑候选清单，顺序不代表评分或排名；未实时核验营业、开放、价格和近期评价。景点可能需要支线车程或许可，不能默认全部顺路。</p>`+(g.notice?`<p class="limited-notice">${g.notice}</p>`:'');
 if(state.tab==='sights'){
  $('#detailContent').innerHTML=notice+`<div class="rec-section-title"><h4>景点与沿途看点</h4><span>3 项规划参考</span></div>`+cards(g.sights,'查景点与开放信息')+item('这一段怎么走',s.drive)+`<p class="note">${s.sights} 海拔为近似值，高原行程需循序适应。</p>`;
 }else if(state.tab==='hotels'){
  const specific=g.hotels.filter(i=>i.kind==='hotel').length;
  $('#detailContent').innerHTML=`<div class="budget-banner"><b>你的住宿偏好：${lodgingPreference.budget}</b><p>${lodgingPreference.criteria}。这是目标预算，不是酒店报价；旺季、湖区及高品质酒店可能明显超出。</p>${link(g.location+' 舒适型酒店 停车','按目的地查酒店')}</div>`+notice+(specific?`<div class="rec-section-title"><h4>先按舒适型预算查找</h4><span>3 项筛选条件 · 不是具体酒店</span></div>`+cards(comfortHotelSearches(g),'查舒适型房源'):'')+`<div class="rec-section-title"><h4>${specific?'具体酒店候选（可能超预算）':'住宿查找方向'}</h4><span>${specific?`${specific} 家待核验`:'无已核实名单 · 非三家酒店'}</span></div>`+cards(g.hotels,specific?'查酒店、价格与评价':'查符合条件的住宿')+item('预订前确认','先按日期筛选 300—600 元房源，再确认独立停车、热水、卫生、到店接待和退改政策。高海拔地区另外确认供暖；供氧设施不能代替高原适应或医疗帮助。');
 }else{
  $('#detailContent').innerHTML=notice+`<div class="rec-section-title"><h4>值得尝试的当地味道</h4><span>3 项菜品 / 简餐建议</span></div>`+cards(g.food,'找提供这道菜的餐厅')+restaurantComparison(s,g);
 }
}
$('#routeGrid').addEventListener('click',e=>{const save=e.target.closest('[data-save]');if(save){const id=save.dataset.save;const exists=saved.includes(id);saved=exists?saved.filter(x=>x!==id):[...saved,id];try{localStorage.setItem('xiangye-saved',JSON.stringify(saved));toast(exists?'已取消收藏':'已收藏路线');}catch{toast('已更新本次收藏；浏览器无法保存，下次打开可能丢失');}renderCards();return;}const select=e.target.closest('[data-route]');if(select){listReturn={y:window.scrollY,id:select.dataset.route};state.route=routes.find(r=>r.id===select.dataset.route);state.stop=0;renderCards();renderJourney();$('#journey').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}});
$('#backToRoutes').addEventListener('click',()=>{
 const target=listReturn&&document.querySelector(`[data-route="${listReturn.id}"]`);
 if(target){target.focus({preventScroll:true});window.scrollTo({top:listReturn.y,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 else{$('#routes').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});$('#search').focus({preventScroll:true});}
});
document.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{state.region=button.dataset.region;document.querySelectorAll('[data-region]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderCards();}));
$('#search').addEventListener('input',e=>{state.query=e.target.value;renderCards();});$('#duration').addEventListener('change',e=>{state.duration=e.target.value;renderCards();});$('#savedToggle').addEventListener('click',()=>{state.savedOnly=!state.savedOnly;renderCards();$('#routes').scrollIntoView();});$('#stops').addEventListener('click',e=>{const b=e.target.closest('[data-stop]');if(b){state.stop=Number(b.dataset.stop);renderJourney();}});document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;renderDetails();}));
$('#export').addEventListener('click',()=>{const blob=new Blob([roadbook(state.route,preparedItems())],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`向野-${state.route.title}.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('路书已导出');});
renderCards();renderJourney();
