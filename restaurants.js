// Brand-level editorial candidates, not verified branches or current menus.
// Do not add ratings, prices, parking claims or verification dates without evidence.
export const restaurantCandidates = {
'成都':[
{name:'龙抄手',dish:'担担面',strength:'川味小吃品牌，可作为同时查询面食与其他成都小吃的候选。',weakness:'尚未选定具体门店；担担面供应、停车、营业及排队情况需逐店核实。',status:'品牌候选 · 门店及菜单待核验'},
{name:'钟水饺',dish:'钟水饺',strength:'以同名成都小吃为查询目标，适合围绕水饺安排小吃体验。',weakness:'同名或近似店名需辨认；具体门店、菜单、营业与停车尚未核实。',status:'品牌候选 · 门店及菜单待核验'},
{name:'蜀九香火锅',dish:'川味火锅',strength:'川味火锅品牌候选，适合多人围绕火锅安排正餐。',weakness:'需先选具体门店并确认辣度、锅底收费、餐位与停车；未核实当日人均。',status:'品牌候选 · 门店及菜单待核验'}
]};
export function restaurantsForStop(stop){return restaurantCandidates[stop.name==='库尔勒（分段返程）'?'库尔勒':stop.name]||[];}
export function restaurantQuery(location,entry){return `${location} ${entry.name} ${entry.dish}`;}
export function restaurantRoadbook(stop,location){const entries=restaurantsForStop(stop);return entries.length?'餐厅对比（品牌候选，不是已核验门店）\n'+entries.map((r,i)=>`${i+1}. ${r.name} · 对应美食：${r.dish}\n优势：${r.strength}\n劣势 / 待核实：${r.weakness}\n状态：${r.status}\n查询：https://uri.amap.com/search?keyword=${encodeURIComponent(restaurantQuery(location,r))}`).join('\n'):'餐厅资料尚未核验：请按菜品查询具体门店，确认菜单、营业、停车及近期评价；不把搜索结果直接当作推荐。';}
