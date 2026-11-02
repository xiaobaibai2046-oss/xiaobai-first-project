import {attachFigure} from './figures.js';
import './numeric-exercises.js';
import './transfer-exercises.js';
import './english-exercises.js';
import './chemistry-exercises.js';
import './chinese-exercises.js';
import './biology-exercises.js';
import './history-exercises.js';
import './geography-exercises.js';
import './ethics-exercises.js';
import {extraExercises} from './quality-bank.js';
export function buildExercises(note){
 const first={id:note.id+'::1',lessonId:note.id,type:'choice',label:'基础判断 / 单选',question:note.question,options:note.options,answer:note.answer,explanation:note.explanation,hint:note.hint||note.tip||note.body,origin:'original-foundation'};
 return [first,...(extraExercises.get(note.title)||[]).map((q,i)=>({...attachFigure(note.title,q),id:note.id+'::applied-'+(i+1),lessonId:note.id}))];
}
