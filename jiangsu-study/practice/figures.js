// Diagrams are tied to the actual supplied values. They do not introduce extra exercises.
export function attachFigure(title,q){
 if(title==='勾股定理'){
  let m=q.question.match(/两条直角边长分别为 (\d+) cm、(\d+) cm/);
  if(m)return {...q,figure:{type:'triangle',horizontal:Number(m[2]),vertical:Number(m[1]),labels:[`${m[2]} cm`,`${m[1]} cm`,'? cm']}};
  m=q.question.match(/斜边为 (\d+) cm，一条直角边为 (\d+) cm/);
  if(m)return {...q,figure:{type:'triangle',horizontal:Math.sqrt(Number(m[1])**2-Number(m[2])**2),vertical:Number(m[2]),labels:['? cm',`${m[2]} cm`,`${m[1]} cm`]}};
  m=q.question.match(/长方形长 (\d+) cm、宽 (\d+) cm/);
  if(m)return {...q,figure:{type:'rectangle',horizontal:Number(m[1]),vertical:Number(m[2]),labels:[`${m[1]} cm`,`${m[2]} cm`,'? cm']}};
 }
 if(title==='光的反射定律'&&q.question.includes('镜面夹角')){const m=q.question.match(/镜面夹角为 (\d+)/);if(m)return {...q,figure:{type:'reflection',mirrorAngle:Number(m[1])}};}
 if(title==='速度与单位换算'&&q.question.includes('跑步者前')){const m=q.question.match(/前 (\d+) min 跑 (\d+) m，后 (\d+) min 跑 (\d+) m/);if(m)return {...q,figure:{type:'table',caption:'两段行程记录',headings:['阶段','路程 / m','时间 / min'],rows:[['前段',m[2],m[1]],['后段',m[4],m[3]]]}};}
 return q;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function figureHTML(figure){
 if(!figure)return '';
 if(figure.type==='table')return `<figure class="question-figure"><table><caption>${esc(figure.caption)}</caption><thead><tr>${figure.headings.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${figure.rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></figure>`;
 if(['triangle','rectangle'].includes(figure.type)){
  const width=220,height=220*figure.vertical/figure.horizontal,x=60,y=250;
  const points=figure.type==='triangle'?`${x},${y} ${x+width},${y} ${x},${y-height}`:`${x},${y} ${x+width},${y} ${x+width},${y-height} ${x},${y-height}`;
  return `<figure class="question-figure"><svg viewBox="0 0 360 300" role="img" aria-label="${figure.type==='triangle'?'直角三角形':'长方形'}，边长与未知量见图中文字"><polygon points="${points}" fill="#edf5ef" stroke="#173e35" stroke-width="2"/>${figure.type==='rectangle'?`<path d="M${x},${y-height} L${x+width},${y}" stroke="#527d6e" stroke-width="2" stroke-dasharray="6 4"/>`:''}<path d="M${x+14},${y} v-14 h-14" fill="none" stroke="#173e35"/><text x="170" y="277" text-anchor="middle">${esc(figure.labels[0])}</text><text x="52" y="${y-height/2}" text-anchor="end">${esc(figure.labels[1])}</text><text x="${x+width/2+18}" y="${y-height/2-12}">${esc(figure.labels[2])}</text><text x="60" y="${y-height-14}">A</text><text x="286" y="250">B</text><text x="40" y="250">C</text></svg><figcaption>按题中边长比例示意；计算须依据条件。</figcaption></figure>`;
 }
 if(figure.type==='reflection'){
  const angle=figure.mirrorAngle*Math.PI/180,dx=140*Math.cos(angle),dy=140*Math.sin(angle);
  return `<figure class="question-figure"><svg viewBox="0 0 360 240" role="img" aria-label="光线射向平面镜，给定角度标在光线与镜面之间，反射角待求"><path d="M20 190 H340" stroke="#173e35" stroke-width="4"/><path d="M180 20 V210" stroke="#879e93" stroke-dasharray="5 5"/><path d="M${180-dx} ${190-dy} L180 190 L${180+dx} ${190-dy}" fill="none" stroke="#cd7038" stroke-width="3"/><text x="110" y="183">${figure.mirrorAngle}°</text><text x="185" y="38">法线</text><text x="24" y="220">平面镜</text><text x="12" y="${175-dy}">入射光线</text><text x="250" y="${175-dy}">反射光线</text><text x="200" y="${173-dy/2}">r=?</text></svg><figcaption>给定角与镜面相邻；反射角 r 从法线起量。</figcaption></figure>`;
 }
 return '';
}
