import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,subjects} from './data.js';
import {hasExercise,recordAnswer,emptyState} from './model.js';
import {practiceCount} from './practice/index.js';
import {sourcedQuestions} from './sourced-exams.js';
import {paperCatalog} from './paper-catalog.js';
import {normalizeExamState,emptyExamState,answerExam,validateQuestion} from './exams.js';
test('every one of 900 knowledge points has a usable authored exercise and explanation',()=>{
 assert.equal(lessons.filter(hasExercise).length,900);assert.equal(practiceCount,771);
 for(const subject of subjects){const items=lessons.filter(l=>l.subject===subject.id);assert.equal(items.length,100);assert.ok(items.every(hasExercise));const checks=items.filter(l=>l.questionType==='concept-check');assert.ok(checks.some(l=>l.checkTruth));assert.ok(checks.some(l=>!l.checkTruth));}
 for(const l of lessons){assert.ok(l.explanation.length>15);assert.equal(new Set(l.options).size,l.options.length);if(l.questionType==='concept-check'){assert.ok(l.hint.length>5);assert.ok(l.checkStatement.trim());assert.equal(l.options[l.answer],l.checkTruth?'表述正确':'表述错误');}}
});
test('representative mathematical and scientific misconceptions are rejected',()=>{
 for(const title of ['分式方程与增根','完全平方公式','氧化物的判断','晶体熔化的特点','基因型与表现性状']){const l=lessons.find(l=>l.title===title);assert.equal(l.checkTruth,title==='基因型与表现性状');const wrong=(l.answer+1)%l.options.length;let state=recordAnswer(emptyState(),l.id,wrong);assert.deepEqual(state.wrong,[l.id]);state=recordAnswer(state,l.id,l.answer);assert.deepEqual(state.wrong,[]);}
});
test('regional source exercises are adaptations with explicit source scope, not official original claims',()=>{
 assert.equal(sourcedQuestions.length,17);assert.deepEqual([...new Set(sourcedQuestions.map(q=>q.year))].sort(),[2022,2023,2024,2025,2026]);assert.deepEqual([...new Set(sourcedQuestions.map(q=>q.city))].sort(),['安徽省','深圳']);
 for(const q of sourcedQuestions){assert.equal(q.kind,'adapted');assert.equal(q.verification,'transcript-reviewed');assert.match(q.reviewScope,/未独立核验/);assert.ok(q.adaptationNote.length>10);assert.match(q.source.commit,/^[0-9a-f]{40}$/);assert.match(q.source.sha256,/^[0-9a-f]{64}$/);assert.ok(q.lessonIds.length>0);assert.ok(q.lessonIds.every(id=>lessons.some(l=>l.id===id)));}
 const scientific=sourcedQuestions.find(q=>q.year===2024&&q.city==='安徽省'&&q.questionNumber==='2');assert.equal(scientific.options[scientific.answer],'9.44×10⁶');
 const probability=sourcedQuestions.find(q=>q.city==='深圳'&&q.year===2025&&q.questionNumber==='3');assert.equal(probability.options[probability.answer],'1/4');
});
test('source catalog distinguishes 22 document entries from 5 partial text entries',()=>{
 assert.equal(paperCatalog.length,27);assert.equal(paperCatalog.filter(p=>p.accessKind==='paper-transcript').length,22);assert.equal(paperCatalog.filter(p=>p.accessKind==='transcript-section').length,5);
 for(const p of paperCatalog){assert.ok(p.year>=2022&&p.year<=2026);assert.match(p.url,/^https:\/\/github\.com\//);assert.match(p.sourceSha256,/^[a-f0-9]{64}$/);assert.ok(p.limitations.length>10);}
 assert.ok(paperCatalog.some(p=>p.sourceType==='回忆版转录'));assert.ok(paperCatalog.some(p=>p.sourceType==='机构加工/转录'));
});
test('source question answers survive reload independently of old Nanjing imports',()=>{
 const q=sourcedQuestions[0];let s=answerExam(emptyExamState(),q,(q.answer+1)%q.options.length);assert.ok(s.wrong.includes(q.id));assert.deepEqual(normalizeExamState(JSON.parse(JSON.stringify(s))),s);s=answerExam(s,q,q.answer);assert.deepEqual(s.wrong,[]);
 const raw={year:2024,city:'深圳',subject:'math',questionNumber:'1',type:'single-choice',prompt:'这是本机用户提供的试题内容。',options:['甲','乙'],answer:0,explanation:'这是用户自己的参考说明。',source:{title:'用户文件',locator:'第1题'},kind:'original',verification:'verified'};
 const imported=validateQuestion(raw);assert.equal(imported.verification,'user-provided');assert.equal(imported.kind,'original');assert.notEqual(imported.id,q.id);
});
