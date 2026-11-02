import {editionRefs} from './curriculum.js';
import {lessons} from './data.js';
export const STORAGE_KEY='zhixu-nanjing-v1';
export const emptyState=()=>({completed:[],wrong:[],attempts:[]});
export function normalizeState(raw){
 const ids=new Set(lessons.map(l=>l.id));
 const exerciseIds=new Set(lessons.flatMap(l=>l.exercises.map(q=>q.id)));
 const validIds=value=>Array.isArray(value)?[...new Set(value.filter(id=>ids.has(id)))]:[];
 const attempts=Array.isArray(raw?.attempts)?raw.attempts.filter(a=>a&&ids.has(a.id)&&(!a.exerciseId||exerciseIds.has(a.exerciseId))&&typeof a.correct==='boolean'&&typeof a.at==='string'&&Number.isFinite(Date.parse(a.at))).slice(-1000):[];
 const result={completed:validIds(raw?.completed),wrong:validIds(raw?.wrong),attempts};
 if(Array.isArray(raw?.exerciseWrong)){result.exerciseWrong=[...new Set(raw.exerciseWrong.filter(id=>exerciseIds.has(id)))];result.wrong=[...new Set(result.exerciseWrong.map(id=>id.split('::')[0]))];}
 return result;
}
export function filterLessons({subject='all',grade='all',query='',edition='all',unit='all'}={}){
 const term=query.trim().toLocaleLowerCase();
 return lessons.filter(l=>(subject==='all'||l.subject===subject)&&(unit==='all'||l.unit===unit)&&(grade==='all'||(edition==='all'?l.grade===Number(grade):editionRefs(l,edition).some(ref=>ref.grade===Number(grade))))&&(edition==='all'||editionRefs(l,edition).length>0)&&(!term||`${l.title} ${l.unit} ${l.body} ${l.example||''} ${l.tip||''}`.toLocaleLowerCase().includes(term)));
}
export function recordAnswer(state,id,selected,at=new Date().toISOString()){
 const lesson=lessons.find(l=>l.id===id);
 if(!lesson||!hasExercise(lesson)||!Number.isInteger(selected)||selected<0||selected>=lesson.options.length)throw new Error('Invalid answer');
 const correct=selected===lesson.answer;
 return {...state,wrong:correct?state.wrong.filter(x=>x!==id):[...new Set([...state.wrong,id])],attempts:[...state.attempts,{id,correct,at}].slice(-1000)};
}
export function metrics(state){const count=state.attempts.length;return {completed:state.completed.length,answered:count,accuracy:count?Math.round(state.attempts.filter(a=>a.correct).length/count*100):null,wrong:state.wrong.length};}

export function hasExercise(lesson){return typeof lesson?.question==='string'&&Array.isArray(lesson.options)&&lesson.options.length>=2&&lesson.options.length<=8&&Number.isInteger(lesson.answer)&&lesson.answer>=0&&lesson.answer<lesson.options.length;}
export function subjectCoverage(){return [...new Set(lessons.map(l=>l.subject))].map(subject=>{const items=lessons.filter(l=>l.subject===subject);return {subject,knowledgePoints:items.length,exercises:items.reduce((n,l)=>n+l.exercises.length,0),linked:items.filter(l=>l.textbookRefs.length>0).length,units:new Set(items.map(l=>l.unit)).size};});}
export function paginate(items,page=1,pageSize=36){const pages=Math.max(1,Math.ceil(items.length/pageSize)),current=Math.min(Math.max(1,page),pages);return {items:items.slice((current-1)*pageSize,current*pageSize),page:current,pages,total:items.length,start:items.length?(current-1)*pageSize+1:0,end:Math.min(current*pageSize,items.length)};}

export function recordExercise(state,exerciseId,selected,at=new Date().toISOString()){
 const lesson=lessons.find(l=>l.exercises.some(q=>q.id===exerciseId)),q=lesson?.exercises.find(q=>q.id===exerciseId);
 if(!q)throw new Error('Invalid exercise');
 const wrong=new Set(state.exerciseWrong||state.wrong.map(id=>id+'::1'));
 if(!Number.isInteger(selected)||selected<0||selected>=q.options.length)throw new Error('Invalid answer');
 const correct=selected===q.answer;if(correct)wrong.delete(q.id);else wrong.add(q.id);
 return {...state,exerciseWrong:[...wrong],wrong:[...new Set([...wrong].map(id=>id.split('::')[0]))],attempts:[...state.attempts,{id:lesson.id,exerciseId,correct,at}].slice(-1000)};
}
