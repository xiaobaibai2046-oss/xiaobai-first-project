import {editionRefs} from './curriculum.js';
import {lessons} from './data.js';
export const STORAGE_KEY='zhixu-nanjing-v1';
export const emptyState=()=>({completed:[],wrong:[],attempts:[]});
export function normalizeState(raw){
 const ids=new Set(lessons.map(l=>l.id));
 const validIds=value=>Array.isArray(value)?[...new Set(value.filter(id=>ids.has(id)))]:[];
 const attempts=Array.isArray(raw?.attempts)?raw.attempts.filter(a=>a&&ids.has(a.id)&&typeof a.correct==='boolean'&&typeof a.at==='string'&&Number.isFinite(Date.parse(a.at))).slice(-1000):[];
 return {completed:validIds(raw?.completed),wrong:validIds(raw?.wrong),attempts};
}
export function filterLessons({subject='all',grade='all',query='',edition='all'}={}){
 const term=query.trim().toLocaleLowerCase();
 return lessons.filter(l=>(subject==='all'||l.subject===subject)&&(grade==='all'||(edition==='all'?l.grade===Number(grade):editionRefs(l,edition).some(ref=>ref.grade===Number(grade))))&&(edition==='all'||editionRefs(l,edition).length>0)&&(!term||`${l.title} ${l.unit} ${l.body}`.toLocaleLowerCase().includes(term)));
}
export function recordAnswer(state,id,selected,at=new Date().toISOString()){
 const lesson=lessons.find(l=>l.id===id);
 if(!lesson||!Number.isInteger(selected)||selected<0||selected>=lesson.options.length)throw new Error('Invalid answer');
 const correct=selected===lesson.answer;
 return {...state,wrong:correct?state.wrong.filter(x=>x!==id):[...new Set([...state.wrong,id])],attempts:[...state.attempts,{id,correct,at}].slice(-1000)};
}
export function metrics(state){const count=state.attempts.length;return {completed:state.completed.length,answered:count,accuracy:count?Math.round(state.attempts.filter(a=>a.correct).length/count*100):null,wrong:state.wrong.length};}
