import {sourcedQuestions} from '../sourced-exams.js';
import {paperCatalog} from '../paper-catalog.js';
import {writeFileSync} from 'node:fs';
import {lessons,subjects,gradeName} from '../data.js';
import {hasExercise,subjectCoverage} from '../model.js';
import {textbooks} from '../textbook-catalog.js';
const fail=message=>{throw new Error(message);};
if(new Set(lessons.map(l=>l.id)).size!==lessons.length)fail('Duplicate lesson IDs');
for(const subject of subjects){
 const items=lessons.filter(l=>l.subject===subject.id);
 if(items.length<100)fail(`${subject.name} has only ${items.length} points`);
 const normalized=items.map(l=>l.title.replace(/[\s·—、，。]/g,''));
 if(new Set(normalized).size!==items.length)fail(`${subject.name} contains duplicate titles`);
 if(new Set(items.map(l=>l.body)).size!==items.length)fail(`${subject.name} contains duplicate explanations`);
 for(const l of items){
  if(l.body.length<25||!l.unit||![7,8,9].includes(l.grade))fail(`Incomplete note: ${l.id}`);
  if(/待编写|待补充正文|示例知识点|占位内容|TODO/.test(l.body))fail(`Placeholder note: ${l.id}`);
  if(l.exerciseKind==='original-practice'&&!hasExercise(l))fail(`Broken practice: ${l.id}`);
  if(l.contentFormat==='concept-note'&&l.textbookRefs.length)fail(`Unexpected generated textbook provenance: ${l.id}`);
 }
}
const report={version:'2026-10-29-practice-900',knowledgePoints:lessons.length,originalExercises:lessons.filter(hasExercise).length,conceptNotesWithoutExercise:lessons.filter(l=>!hasExercise(l)).length,originalMultipleChoiceExercises:lessons.filter(l=>l.options?.length===4).length,originalConceptChecks:lessons.filter(l=>l.questionType==='concept-check').length,sourceAdaptations:sourcedQuestions.length,publicResourceEntries:paperCatalog.length,textbookBooks:textbooks.length,textbookChapters:textbooks.flatMap(b=>b.chapters).length,linkedKnowledgePoints:lessons.filter(l=>l.textbookRefs.length).length,verifiedPastPaperQuestions:0,scope:'原创通用基础，年级为建议。旧版目录关联与已配题分别统计；不代表现行教材或中考完整覆盖。',subjects:subjectCoverage().map(row=>({...row,name:subjects.find(s=>s.id===row.subject).name,grades:[7,8,9].map(grade=>({grade,count:lessons.filter(l=>l.subject===row.subject&&l.grade===grade).length}))}))};
writeFileSync(new URL('../content-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
writeFileSync(new URL('../knowledge-index.json',import.meta.url),JSON.stringify(lessons.map(l=>({id:l.id,subject:l.subject,subjectName:subjects.find(s=>s.id===l.subject).name,gradeSuggestion:gradeName(l.grade),title:l.title,unit:l.unit,alignmentStatus:l.alignmentStatus,hasExercise:hasExercise(l)})),null,2)+'\n');
console.log(JSON.stringify(report,null,2));
