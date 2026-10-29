import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,subjects} from './data.js';
import {emptyState,filterLessons,normalizeState,recordAnswer,metrics} from './model.js';
test('curriculum cards have valid subject links and single-answer questions',()=>{
 assert.equal(new Set(lessons.map(l=>l.id)).size,129);
 for(const s of subjects)assert.equal(lessons.filter(l=>l.subject===s.id).length,({math:32,biology:27}[s.id]||10));
 for(const l of lessons){assert.ok(subjects.some(s=>s.id===l.subject));assert.ok([7,8,9].includes(l.grade));assert.equal(l.options.length,4);assert.ok(l.answer>=0&&l.answer<4);for(const key of ['body','tip','example','explanation'])assert.ok(l[key].length>10);}
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
