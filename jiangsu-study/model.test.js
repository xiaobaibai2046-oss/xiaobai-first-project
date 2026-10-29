import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,subjects} from './data.js';
import {emptyState,filterLessons,normalizeState,recordAnswer,metrics,hasExercise,paginate,subjectCoverage} from './model.js';
test('all notes have valid subjects and distinguish reading-only cards from scored exercises',()=>{
 assert.equal(new Set(lessons.map(l=>l.id)).size,900);
 for(const s of subjects)assert.equal(lessons.filter(l=>l.subject===s.id).length,100);
 for(const l of lessons){assert.ok(subjects.some(s=>s.id===l.subject));assert.ok([7,8,9].includes(l.grade));assert.ok(l.body.length>=25);if(hasExercise(l)&&l.contentFormat!=='concept-note'){assert.equal(l.options.length,4);assert.ok(l.answer>=0&&l.answer<4);for(const key of ['tip','example','explanation'])assert.ok(l[key].length>10);}else{assert.equal(l.contentFormat,'concept-note');assert.ok(l.reviewPrompt.length>10);assert.ok(hasExercise(l));assert.equal(l.questionType,'concept-check');assert.equal(l.options.length,2);assert.ok(l.explanation.length>25);assert.ok(l.hint.length>5);}}
});
test('subject, grade and Chinese query combine without unrelated results',()=>{
 assert.equal(filterLessons({subject:'chemistry',grade:'7'}).length,0);
 assert.equal(filterLessons({subject:'math',grade:'9',query:'求根'}).length,1);
 assert.equal(filterLessons({query:'不存在的知识点'}).length,0);
});
test('wrong answer enters notebook once; correct retry removes it and records both attempts',()=>{
 const l=lessons[0];let s=recordAnswer(emptyState(),l.id,(l.answer+1)%4);
 s=recordAnswer(s,l.id,(l.answer+1)%4);assert.deepEqual(s.wrong,[l.id]);
 s=recordAnswer(s,l.id,l.answer);assert.deepEqual(s.wrong,[]);assert.equal(metrics(s).answered,3);assert.equal(metrics(s).accuracy,33);
 assert.throws(()=>recordAnswer(s,l.id,9));
});
test('restoring corrupted storage rejects unknown IDs and invalid records',()=>{
 const s=normalizeState({completed:['lesson-1','lesson-1','bad'],wrong:'bad',attempts:[null,{id:'bad',correct:true,at:'2026-01-01'},{id:'lesson-1',correct:true,at:'invalid'}]});
 assert.deepEqual(s,{completed:['lesson-1'],wrong:[],attempts:[]});assert.equal(metrics(emptyState()).accuracy,null);
});

test('900 accessible notes include 100 per subject and each have scored practice with separate source counts',()=>{
 const report=subjectCoverage();assert.equal(report.length,9);assert.ok(report.every(r=>r.knowledgePoints>=100));assert.equal(report.reduce((n,r)=>n+r.exercises,0),900);
 for(const subject of subjects){const items=lessons.filter(l=>l.subject===subject.id);assert.equal(new Set(items.map(l=>l.title)).size,items.length);assert.equal(new Set(items.map(l=>l.body)).size,items.length);assert.ok(new Set(items.map(l=>l.unit)).size>=3);}
 const note=lessons.find(l=>l.id==='foundation-math-1');assert.equal(recordAnswer(emptyState(),note.id,note.answer).attempts[0].correct,true);
});
test('pagination neither hides nor repeats content across 900 notes and reset results',()=>{
 const all=[];for(let page=1;page<=25;page++)all.push(...paginate(lessons,page).items.map(l=>l.id));assert.deepEqual(all,lessons.map(l=>l.id));
 assert.equal(paginate(lessons,26).page,25);assert.equal(paginate([],5).page,1);assert.equal(paginate([],1).start,0);
 const chinese=filterLessons({subject:'chinese'});assert.equal(chinese.length,100);assert.deepEqual([1,2,3].flatMap(p=>paginate(chinese,p).items.map(l=>l.id)),chinese.map(l=>l.id));
 const unit=chinese.at(-1).unit;assert.ok(filterLessons({subject:'chinese',unit}).every(l=>l.unit===unit));
});
test('pre-expansion learning records survive the increase from 129 to 900 notes',()=>{
 const saved={completed:['lesson-1','expanded-1','chapter-core-1'],wrong:['lesson-1'],attempts:[{id:'lesson-1',correct:false,at:'2026-10-28T08:00:00.000Z'}]};
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(saved))),saved);
 assert.equal(filterLessons({subject:'math',query:'−2x'}).length,1);
});
