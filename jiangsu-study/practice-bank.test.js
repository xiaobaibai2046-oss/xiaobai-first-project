import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,subjects} from './data.js';
import {emptyState,recordExercise,normalizeState,metrics} from './model.js';
test('all 900 points have ten distinct exercises, with explicit assessment modes',()=>{
 const ids=new Set();
 for(const l of lessons){assert.equal(l.exercises.length,10);assert.equal(new Set(l.exercises.map(q=>q.question)).size,10);
  assert.equal(l.exercises.filter(q=>q.type==='choice').length,5);assert.equal(l.exercises.filter(q=>q.type==='written').length,5);
  for(const q of l.exercises){assert.ok(!ids.has(q.id));ids.add(q.id);assert.equal(q.lessonId,l.id);assert.ok(q.explanation.length>15);
   if(q.type==='choice'){assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.options[q.answer]);if(q.origin==='note-derived'){const reconstructed=q.question.split('\n').slice(1).join('\n').replace('【　　】',q.options[q.answer]);assert.equal(reconstructed,l.body);}}
   else{assert.ok(q.reference.length>20);assert.ok(q.checklist.length>10);}
  }
 }
 assert.equal(ids.size,9000);for(const s of subjects)assert.equal(lessons.filter(l=>l.subject===s.id).flatMap(l=>l.exercises).length,1000);
});
test('answering a different exercise does not erase an unresolved wrong answer; reload preserves it',()=>{
 const [a,b]=lessons[0].exercises;let state=recordExercise(emptyState(),a.id,(a.answer+1)%a.options.length);
 state=recordExercise(state,b.id,b.answer);assert.deepEqual(state.wrong,[a.lessonId]);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
 state=recordExercise(state,a.id,a.answer);assert.deepEqual(state.wrong,[]);
 assert.throws(()=>recordExercise(state,a.id,99));assert.throws(()=>recordExercise(state,'bad',0));
});
test('written practice persists self assessment without inflating objective accuracy',()=>{
 const q=lessons[0].exercises[5];let state=recordExercise(emptyState(),q.id,false);assert.equal(metrics(state).answered,0);assert.equal(metrics(state).accuracy,null);assert.deepEqual(state.wrong,[q.lessonId]);
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);state=recordExercise(state,q.id,true);assert.deepEqual(state.wrong,[]);assert.equal(state.selfAttempts.length,2);assert.throws(()=>recordExercise(state,q.id,1));
});
test('legacy wrong records remain until the corresponding original exercise is corrected',()=>{
 const l=lessons[0];let state={...emptyState(),wrong:[l.id]};state=recordExercise(state,l.exercises[1].id,l.exercises[1].answer);assert.deepEqual(state.wrong,[l.id]);state=recordExercise(state,l.exercises[0].id,l.answer);assert.deepEqual(state.wrong,[]);
});
