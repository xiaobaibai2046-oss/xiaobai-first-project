// Reading drills are derived from the actual note, not represented as authored exam questions.
const labels={math:'列出一组具体数值，逐步演示，并检查运算条件',chinese:'写一个句子或短段落，展示这一知识点的用法',english:'写一个英语例句，并用中文说明它体现了哪条规则',physics:'描述一个生活现象或实验，说明条件、现象与结论',chemistry:'描述一个物质或实验实例，区分观察现象与推断',biology:'选一种生物、结构或生命现象，解释它与知识点的联系',history:'结合这一事件或制度，说明背景、变化与影响，避免混淆时间',geography:'选一个地区或地图判读情境，说明条件和判断依据',ethics:'设计一个校园或生活情境，写出具体行动及理由'};
export function buildExercises(note){
 const first={id:note.id+'::1',lessonId:note.id,type:'choice',label:'基础判断 / 单选',question:note.question,options:note.options,answer:note.answer,explanation:note.explanation,hint:note.hint||note.tip||note.body};
 const segments=[...new Intl.Segmenter('zh-CN',{granularity:'word'}).segment(note.body)].filter(s=>s.isWordLike&&s.segment.length>=2);
 let unique=[...new Map(segments.map(s=>[s.segment,s])).values()];
 if(unique.length<4)unique=[...new Map([...new Intl.Segmenter('zh-CN',{granularity:'word'}).segment(note.body)].filter(s=>s.isWordLike).map(s=>[s.segment,s])).values()];
 if(unique.length<4)throw new Error(`Not enough distinct reading targets: ${note.id}`);
 const blanks=Array.from({length:4},(_,i)=>{
  const chosen=unique[Math.floor(i*unique.length/4)],others=unique.filter(s=>s.segment!==chosen.segment);
  const options=[chosen.segment,...others.slice(0,3).map(s=>s.segment)];
  const shift=(i+note.id.length)%4;options.push(...options.splice(0,shift));
  return {id:note.id+'::'+(i+2),lessonId:note.id,type:'choice',label:'讲解回忆填空',question:`依据本知识点讲解，选择原句中缺少的词语（侧重阅读回忆）：\n${note.body.slice(0,chosen.index)}【　　】${note.body.slice(chosen.index+chosen.segment.length)}`,options,answer:options.indexOf(chosen.segment),hint:`回想“${note.title}”的完整表述。`,explanation:`原句应填“${chosen.segment}”。\n${note.body}`,origin:'note-derived'};
 });
 const sentences=note.body.match(/[^。！？]+[。！？]?/g)||[note.body];
 const focus=sentences[Math.min(1,sentences.length-1)];
 const tasks=[
  ['概念复述',`不照抄原文，用自己的话解释“${note.title}”。至少说明它研究或解决什么问题，并保留原文中的条件。`,note.body,'是否说清核心含义？是否保留限定条件？'],
  ['关键关系解释',`阅读这一要点：“${focus}”\n解释其中的关键关系；如果涉及公式、时间、对象或步骤，逐项说明其含义。`,`${focus}\n完整依据：${note.body}`,'是否逐项解释了关系？是否遗漏对象、条件或先后顺序？'],
  ['举例应用',`围绕“${note.title}”：${labels[note.subject]}。写出过程，不能只给结论。`,`${note.example?`可参考已有例子：${note.example}\n`:''}核对依据：${note.body}`,'例子是否符合知识点的条件？过程是否支持结论？开放情境可有多种答案，存疑时请教师核对。'],
  ['易错辨析',`围绕“${note.title}”，写出一个容易混淆或遗漏条件的说法；指出问题，并改成准确说法。`,`${note.tip||note.explanation}\n核对依据：${note.body}`,'是否指出具体错误？改正后是否符合原文？不要把自己设计的错误说法当成事实记忆。'],
  ['迁移与自检',`合上讲解，为“${note.title}”设计一个小问题并作答。说明用到了哪条知识、成立条件，以及如何检查答案。`,`${note.body}\n${note.example||note.tip||''}`,'问题是否确实使用该知识？答案是否说明依据与条件？能否通过代入、材料、实例或规则进行检查？']
 ];
 return [first,...blanks,...tasks.map(([label,question,reference,checklist],i)=>({id:note.id+'::'+(i+6),lessonId:note.id,type:'written',label,question,reference,checklist,explanation:`参考知识与核对要点（不是唯一标准答案）：\n${reference}\n自查：${checklist}`,origin:'guided-task'}))];
}
