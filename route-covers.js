import {routePoints,routeSegmentUncertain} from './route-map.js';
const coverCache=new Map();
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function routeCoverSvg(route){
 const points=routePoints(route),w=480,h=280;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(335/Math.max(maxX-minX,0.00001),155/Math.max(maxY-minY,0.00001));
 const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
 const projected=points.map(p=>({...p,x:240+(p.x-centerX)*scale,y:145+(p.y-centerY)*scale}));
 let lines='',arrows='';
 for(let i=0;i<projected.length-1;i++){
  const a=projected[i],b=projected[i+1],d=`M${a.x.toFixed(1)},${a.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  lines+=`<path d="${d}" stroke="#fff9" stroke-width="6"/><path d="${d}" stroke="#db4b3e" stroke-width="3" ${routeSegmentUncertain(route,i)?'stroke-dasharray="7 5"':''}/>`;
  if(Math.hypot(b.x-a.x,b.y-a.y)>48)arrows+=`<path d="M-5,-4L2,0L-5,4" transform="translate(${(a.x+b.x)/2},${(a.y+b.y)/2}) rotate(${Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI})" stroke="#c83d32" stroke-width="2"/>`;
 }
 const occupied=[];let markers='';
 projected.forEach((p,i)=>{
  if(projected.some((q,j)=>j<i&&q.x===p.x&&q.y===p.y&&q.name===p.name))return;
  const repeats=projected.filter(q=>q.x===p.x&&q.y===p.y&&q.name===p.name),indices=repeats.map(q=>q.index+1);
  const isStart=i===0,isEnd=i===projected.length-1||repeats.some(q=>q.index===projected.length-1);
  const name=p.name.replace('（分段返程）','').replace('新源 / 那拉提','那拉提').replace('米兰（若羌）','米兰');
  const label=(isStart&&isEnd?'起终 ':isStart?'起 ':isEnd?'终 ':'')+name;
  const tw=label.length*10+10,th=18;
  const offsets=[[14,-18],[14,14],[-tw-14,-18],[-tw-14,14],[-tw/2,-32],[-tw/2,26],[14,-48],[-tw-14,44]];
  let box;
  for(const [dx,dy] of offsets){const candidate={x:Math.max(8,Math.min(w-tw-8,p.x+dx)),y:Math.max(44,Math.min(h-48,p.y+dy)),w:tw,h:th};if(!occupied.some(b=>candidate.x<b.x+b.w+3&&candidate.x+tw+3>b.x&&candidate.y<b.y+b.h+3&&candidate.y+th+3>b.y)){box=candidate;break;}}
  box||={x:Math.max(8,Math.min(w-tw-8,p.x+14)),y:Math.min(h-48,p.y+26),w:tw,h:th};occupied.push(box);
  markers+=`<g><circle cx="${p.x}" cy="${p.y}" r="${isStart||isEnd?10:8}" fill="${isStart||isEnd?'#c9493d':'#fff'}" stroke="${isStart||isEnd?'#fff':'#c9493d'}" stroke-width="2"/><text x="${p.x}" y="${p.y+3.5}" text-anchor="middle" font-size="${indices.length>1?8:10}" font-weight="700" fill="${isStart||isEnd?'white':'#b23c32'}">${indices.join('/')}</text><rect x="${box.x}" y="${box.y-12}" width="${tw}" height="18" rx="4" fill="#f8f8efee"/><text x="${box.x+5}" y="${box.y}" fill="#294e43" font-size="10" font-weight="600">${xml(label)}</text></g>`;
 });
 const total=route.distance==null?'里程待核实':`${route.distance.toLocaleString('zh-CN')} 公里${route.distanceSource?' · 用户提供':' · 参考'}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"><title>${xml(route.title)}路线示意图</title><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#e8ecdc"/><stop offset="1" stop-color="#c5d7c2"/></linearGradient><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" stroke="#708970" stroke-opacity=".09" fill="none"/></pattern></defs><rect width="480" height="280" fill="url(#bg)"/><rect width="480" height="280" fill="url(#grid)"/><g fill="none" stroke="#789572" opacity=".12"><path d="M-40 230Q100 50 250 150T520 30"/><path d="M-40 250Q100 70 250 170T520 50"/><path d="M-40 270Q100 90 250 190T520 70"/></g><g fill="none" stroke-linejoin="round" stroke-linecap="round">${lines}${arrows}</g><g font-family="system-ui, sans-serif">${markers}<text x="18" y="261" font-size="10" fill="#526e56">${xml(total)}</text><text x="462" y="261" text-anchor="end" font-size="9" fill="#687e63">站点连线示意 · 非导航</text><path d="M449 216V198M445 203L449 198L453 203" stroke="#577557" fill="none"/><text x="449" y="229" text-anchor="middle" fill="#577557" font-size="9">N</text></g></svg>`;
}
export function routeCoverImage(route){const key=route.id+'|'+route.distance+'|'+route.distanceSource;if(!coverCache.has(key))coverCache.set(key,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(routeCoverSvg(route)));return coverCache.get(key);}
