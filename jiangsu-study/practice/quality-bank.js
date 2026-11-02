// Concrete exercises are explicitly linked by exact lesson title.
// Numeric families vary supplied values, not sentences from the lesson notes.
export const extraExercises=new Map();
export function add(title,question,options,answer,explanation,level='巩固应用'){
 if(options.length!==4||new Set(options.map(String)).size!==4||!Number.isInteger(answer)||answer<0||answer>3)throw new Error('Invalid authored exercise: '+title+' '+question);
 const pack=extraExercises.get(title)||[];const correct=String(options[answer]);options=options.map(String);const offset=(pack.length+question.length)%4;options.push(...options.splice(0,offset));pack.push({question,options,answer:options.indexOf(correct),explanation,label:level,type:'choice',origin:'concrete-practice'});extraExercises.set(title,pack);
}
export function numeric(title,question,answer,distractors,explanation,index=0){
 const format=v=>typeof v==='number'?String(Number(v.toFixed(9))):String(v);
 const values=[answer,...distractors].map(format);const unique=[...new Set(values)];
 if(unique.length!==4)throw new Error('Duplicate numerical options: '+title+' '+question+' '+values);
 const shift=index%4;unique.push(...unique.splice(0,shift));add(title,question,unique,unique.indexOf(format(answer)),explanation,'计算 / 条件应用');
}
