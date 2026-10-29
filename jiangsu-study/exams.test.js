import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessons} from './data.js';
import {textbooks} from './textbook-catalog.js';
import {editionRefs} from './curriculum.js';
import {filterLessons} from './model.js';
import {examYears,parseQuestionPack,mergeQuestions,normalizeExamState,emptyExamState,answerExam,verifiedQuestions} from './exams.js';
// Synthetic fixtures exercise the importer; these are never included in the app's past-paper collection.
const fixture=()=>({year:2025,city:'南京',subject:'math',questionNumber:'测试夹具-1',type:'single-choice',prompt:'仅用于测试导入，不是真题：1 + 1 = ?',options:['1','2','3','4'],answer:1,explanation:'测试解析：1 + 1 = 2。',source:{title:'自动化测试夹具（非试卷）',locator:'测试第 1 题',url:'https://example.com/fixture'},lessonIds:['lesson-1'],verification:'verified'});
const pack=q=>JSON.stringify({schemaVersion:1,questions:[q]});
test('five-year window and source status do not invent past questions or textbook coverage',()=>{
 assert.deepEqual(examYears,[2026,2025,2024,2023,2022]);assert.equal(verifiedQuestions.length,0);
 assert.equal(filterLessons({edition:'pep'}).length,29);assert.equal(filterLessons({edition:'sujiao'}).length,27);assert.equal(filterLessons({edition:'suke'}).length,32);
 assert.equal(filterLessons().length,129);
 for(const l of lessons){assert.equal(l.exerciseKind,'original-practice');assert.equal(l.textbookRefs.some(ref=>ref.status==='verified'),false);assert.equal(l.textbookRefs.every(ref=>ref.status==='source-read'),true);}
});
test('verified alignment requires a concrete source locator, revision and reviewer',()=>{
 const ref={edition:'pep',status:'verified',sourceTitle:'Test',sourceUrl:'https://example.com/',locator:'p1',revision:'2024',reviewer:'test',checkedAt:'2026-10-29'};
 assert.equal(editionRefs({textbookRefs:[ref]},'pep').length,1);assert.equal(editionRefs({textbookRefs:[{...ref,revision:''}]},'pep').length,0);
});
test('import forcibly downgrades claimed verification and validates provenance, years and linked lessons',()=>{
 const [q]=parseQuestionPack(pack(fixture()));assert.equal(q.verification,'user-provided');
 for(const patch of [{year:2021},{city:'苏州'},{source:{}},{answer:8},{lessonIds:['nonexistent']},{source:{title:'x',locator:'y',url:'javascript:alert(1)'}},{source:{title:'x',locator:'y',url:'https://user:secret@example.com/'}}])assert.throws(()=>parseQuestionPack(pack({...fixture(),...patch})));
 assert.throws(()=>parseQuestionPack(JSON.stringify({schemaVersion:1,questions:[fixture(),fixture()]})));
});
test('single-choice wrong retry, conflict rejection, and state persistence preserve provenance',()=>{
 const [q]=parseQuestionPack(pack(fixture()));let s={...emptyExamState(),questions:[q]};
 s=answerExam(s,q,0);assert.deepEqual(s.wrong,[q.id]);s=answerExam(s,q,1);assert.deepEqual(s.wrong,[]);assert.equal(s.attempts.length,2);
 assert.deepEqual(normalizeExamState(JSON.parse(JSON.stringify(s))),s);
 assert.equal(mergeQuestions([q],[q]).length,1);assert.throws(()=>mergeQuestions([q],[{...q,prompt:'不同题干'}]));
});
test('written questions require references and never receive automatic correctness scores',()=>{
 const q={...fixture(),type:'written',reference:'这是一份测试参考答案。'};
 const [parsed]=parseQuestionPack(pack(q));assert.equal(parsed.answer,null);assert.deepEqual(parsed.options,[]);
 assert.throws(()=>answerExam(emptyExamState(),parsed,0));delete q.reference;assert.throws(()=>parseQuestionPack(pack(q)));
});
test('downloadable knowledge index stays aligned with current content IDs',()=>{
 const index=JSON.parse(readFileSync(new URL('./knowledge-index.json',import.meta.url),'utf8'));
 assert.deepEqual(index.map(l=>l.id),lessons.map(l=>l.id));
});

test('mirror chapter catalog has exact snapshots and original core introductions, without claiming school applicability',()=>{
 assert.equal(textbooks.length,16);assert.equal(textbooks.flatMap(b=>b.chapters).length,87);
 for(const b of textbooks){assert.match(b.source.commit,/^[0-9a-f]{40}$/);assert.match(b.source.sha256,/^[0-9a-f]{64}$/);assert.ok(b.source.tocPdfPages.every(p=>Number.isInteger(p)&&p>0&&p<=b.source.pdfPages));assert.equal(b.reviewStatus,'mirror-toc-read');for(const ch of b.chapters){assert.equal(ch.coverage,'core-introduction-only');for(const title of ch.lessonTitles)assert.ok(lessons.some(l=>l.title===title));}}
});
test('edition grade filters follow sourced book grades while generic recommendations stay intact',()=>{
 const parallel=lessons.find(l=>l.title==='平行线的性质');assert.equal(parallel.grade,7);
 const similarity=lessons.find(l=>l.title==='反比例函数');assert.equal(similarity.grade,9);
 assert.ok(filterLessons({edition:'suke',grade:'8'}).some(l=>l.id===similarity.id));
 assert.ok(!filterLessons({edition:'pep',grade:'8'}).some(l=>l.id===similarity.id));
});
