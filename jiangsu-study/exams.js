import {lessons,subjects} from './data.js';
export const examYears=[2026,2025,2024,2023,2022];
export const EXAM_STORAGE_KEY='zhixu-nanjing-exams-v1';
// Only source-reviewed records belong here. Never insert generated questions as past papers.
export const verifiedQuestions=[];
const ids=new Set(lessons.map(l=>l.id));
const subjectIds=new Set(subjects.map(s=>s.id));
const text=(value,label,max=12000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label}缺失或长度不合法`);return value.trim();};
function sourceUrl(value){if(!value)return '';const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('来源链接必须是不含账号密码的 HTTPS 地址');return url.href;}
export function validateQuestion(raw){
 if(!raw||typeof raw!=='object')throw new Error('题目必须是对象');
 if(!examYears.includes(raw.year))throw new Error('年份必须是 2022—2026 的整数');
 if(raw.city!=='南京')throw new Error('当前只接收 city 为南京的试题资料');
 if(!subjectIds.has(raw.subject))throw new Error('学科代码不合法');
 if(!['single-choice','written'].includes(raw.type))throw new Error('题型必须为 single-choice 或 written');
 const questionNumber=text(raw.questionNumber,'题号',80),prompt=text(raw.prompt,'题干');
 if(!raw.source||typeof raw.source!=='object')throw new Error('需要原始来源信息');
 const source={title:text(raw.source.title,'来源名称',300),locator:text(raw.source.locator,'页码或原题位置',300),url:sourceUrl(raw.source.url)};
 const lessonIds=Array.isArray(raw.lessonIds)?[...new Set(raw.lessonIds)]:[];
 if(lessonIds.some(id=>!ids.has(id)))throw new Error('关联了不存在的知识点 ID');
 let options=[],answer=null,reference='';
 if(raw.type==='single-choice'){
  if(!Array.isArray(raw.options)||raw.options.length<2||raw.options.length>8)throw new Error('单选题需要 2—8 个选项');
  options=raw.options.map(o=>text(o,'选项',4000));
  if(!Number.isInteger(raw.answer)||raw.answer<0||raw.answer>=options.length)throw new Error('单选答案必须是有效的从 0 开始的选项序号');
  answer=raw.answer;
 }else reference=text(raw.reference,'参考答案或评分说明');
 const explanation=text(raw.explanation,'解析或答案来源说明');
 return {id:`${raw.year}:${raw.subject}:${questionNumber}`,year:raw.year,city:'南京',subject:raw.subject,questionNumber,type:raw.type,prompt,source,lessonIds,options,answer,reference,explanation,verification:'user-provided',kind:'past-paper-claim'};
}
export function parseQuestionPack(content){
 if(typeof content!=='string'||content.length>2000000)throw new Error('文件过大，请分批导入不超过 2 MB 的 JSON');
 const raw=JSON.parse(content);
 if(raw.schemaVersion!==1||!Array.isArray(raw.questions)||!raw.questions.length||raw.questions.length>500)throw new Error('需要 schemaVersion: 1，及 1—500 道 questions');
 const questions=raw.questions.map((q,i)=>{try{return validateQuestion(q);}catch(e){throw new Error(`第 ${i+1} 题：${e.message}`);}});
 if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('同一资料包中存在重复的年份、学科和题号');
 return questions;
}
export function mergeQuestions(existing,incoming){
 const merged=new Map(existing.map(q=>[q.id,q]));
 for(const q of incoming){const current=merged.get(q.id);if(current&&JSON.stringify(current)!==JSON.stringify(q))throw new Error(`题号 ${q.questionNumber} 已存在且内容不同，请先核对资料，未覆盖原题。`);merged.set(q.id,q);}
 if(merged.size>2000)throw new Error('本机题库最多保存 2000 题，请分设备或按需整理');
 return [...merged.values()];
}
export function emptyExamState(){return {questions:[],attempts:[],wrong:[]};}
export function normalizeExamState(raw){
 const questions=[];
 for(const q of Array.isArray(raw?.questions)?raw.questions.slice(0,2000):[]){try{const validated=validateQuestion(q);if(!questions.some(x=>x.id===validated.id))questions.push(validated);}catch{ /* Skip corrupt individual records, retain valid local work. */ }}
 const allowed=new Set([...verifiedQuestions,...questions].map(q=>q.id));
 const attempts=(Array.isArray(raw?.attempts)?raw.attempts:[]).filter(a=>a&&allowed.has(a.id)&&typeof a.correct==='boolean'&&Number.isFinite(Date.parse(a.at))).slice(-1000);
 const wrong=[...new Set((Array.isArray(raw?.wrong)?raw.wrong:[]).filter(id=>allowed.has(id)))];
 return {questions,attempts,wrong};
}
export function answerExam(state,question,index){
 if(question.type!=='single-choice'||!Number.isInteger(index)||index<0||index>=question.options.length)throw new Error('只能自动批改单选题的有效选项');
 const correct=index===question.answer;
 return {...state,attempts:[...state.attempts,{id:question.id,correct,at:new Date().toISOString()}].slice(-1000),wrong:correct?state.wrong.filter(id=>id!==question.id):[...new Set([...state.wrong,question.id])]};
}
