import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,subjects} from './data.js';
import {extraExercises} from './practice/quality-bank.js';
import {emptyState,recordExercise,normalizeState,metrics} from './model.js';
const all=lessons.flatMap(l=>l.exercises);
const value=q=>q.options[q.answer];
test('concrete bank has valid links, distinct prompts, explicit answers and no withdrawn filler',()=>{
 assert.equal(all.length,1432);assert.equal(lessons.filter(l=>l.exercises.length>1).length,90);assert.equal(lessons.filter(l=>l.exercises.length>=10).length,43);
 assert.equal(new Set(all.map(q=>q.id)).size,all.length);
 for(const title of extraExercises.keys())assert.ok(lessons.some(l=>l.title===title),title);
 for(const l of lessons){assert.equal(new Set(l.exercises.map(q=>q.question)).size,l.exercises.length,l.title);
  for(const q of l.exercises){assert.equal(q.lessonId,l.id);assert.equal(q.type,'choice');assert.ok(q.explanation.length>15);assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.options[q.answer]);assert.ok(!/依据本知识点讲解，选择原句|合上讲解，为|自己设计|不照抄原文|先写下你的答案/.test(q.question));assert.notEqual(q.origin,'note-derived');assert.notEqual(q.origin,'guided-task');}
 }
 for(const s of subjects)assert.ok(lessons.filter(l=>l.subject===s.id).flatMap(l=>l.exercises).some(q=>q.origin==='concrete-practice'),s.name);
});
test('representative arithmetic, geometry, physical conditions and chemistry calculations have correct results',()=>{
 const cases=[
 ['有理数的加法','清晨气温为 −3℃','-2'],['有理数的加法','潜水员先下降 4 m','0'],
 ['一次函数的图象','横坐标为 2','3'],['一元二次方程的求根公式','x²−6x+8','2，4'],
 ['一元二次方程的求根公式','x²+4x+5','没有实数根'],['整式的合并同类项','4xy−2yx','-4'],
 ['平行线的性质','同旁内角中一个角为 35','145'],['勾股定理','斜边为 13 cm','12'],
 ['勾股定理','长方形长 12 cm','13'],['分式的有意义条件','当 x=2 时','有意义，值为 0'],
 ['相似三角形的面积比','面积比为 1:4','1:2'],['速度与单位换算','36 km/h','10'],
 ['光的反射定律','镜面夹角为 20','70'],['阿基米德原理','从水面下 0.2 m','不变'],
 ['密度及计算','切去一半','2'],['串联与并联电路','干路电流 0.6 A','0.4'],
 ['电功率','100 W 的灯','0.2'],['机械效率','有用功 50 J，总功 100 J','50%'],
 ['溶液的溶质质量分数','加水稀释到 200 g','5%'],['原子与离子','Al³⁺','10']
 ];
 for(const [title,fragment,expected] of cases){const q=lessons.find(l=>l.title===title).exercises.find(q=>q.origin==='concrete-practice'&&q.question.includes(fragment));assert.ok(q,title+' '+fragment);assert.equal(value(q),expected,title+' '+fragment);}
});
test('material and language answers follow the actual text instead of generic self assessment',()=>{
 for(const [title,fragment,answer] of [
 ['文言词语的语境义','温故而知新','学过的知识'],['记叙文的六要素','社区图书室','事情发生的起因'],
 ['被动语态的基本结构','These books','are read'],['宾语从句的语序','schedule','when the train leaves'],
 ['显微镜成像与视野','左上方','左上方'],['鸦片战争与南京条约','双方协议','关税自主权'],
 ['经纬网定位','某点为 10°N、170°E','北半球、西半球'],['诚信与个人信息保护','验证码','停止提供，向家长或官方渠道核实']
 ]){const q=lessons.find(l=>l.title===title).exercises.find(q=>q.origin==='concrete-practice'&&q.question.includes(fragment));assert.ok(q);assert.equal(value(q),answer);}
});
test('withdrawn generated tasks and their history are removed, valid original history survives',()=>{
 const at='2026-11-02T00:00:00Z',l=lessons[0];
 const s=normalizeState({completed:[l.id],wrong:[l.id],exerciseWrong:[l.id+'::2',l.id+'::6'],selfAttempts:[{exerciseId:l.id+'::6',mastered:false,at}],attempts:[{id:l.id,exerciseId:l.id+'::2',correct:true,at},{id:l.id,exerciseId:l.id+'::1',correct:false,at},{id:l.id,correct:true,at}]});
 assert.deepEqual(s.completed,[l.id]);assert.equal(s.attempts.length,2);assert.deepEqual(s.wrong,[]);assert.ok(!('selfAttempts' in s));assert.deepEqual(s.exerciseWrong,[]);
 assert.throws(()=>recordExercise(s,l.id+'::2',0));
});
test('answering a different exercise never erases unresolved mistakes; corrected retry survives reload',()=>{
 const [a,b]=lessons[0].exercises;let state=recordExercise(emptyState(),a.id,(a.answer+1)%a.options.length);
 state=recordExercise(state,b.id,b.answer);assert.deepEqual(state.wrong,[a.lessonId]);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
 state=recordExercise(state,a.id,a.answer);assert.deepEqual(state.wrong,[]);assert.equal(metrics(state).answered,3);
 assert.throws(()=>recordExercise(state,a.id,99));assert.throws(()=>recordExercise(state,'bad',0));
});
test('legacy wrong records remain until the original exercise is corrected',()=>{
 const l=lessons[0];let state={...emptyState(),wrong:[l.id]};state=recordExercise(state,l.exercises[1].id,l.exercises[1].answer);assert.deepEqual(state.wrong,[l.id]);state=recordExercise(state,l.exercises[0].id,l.answer);assert.deepEqual(state.wrong,[]);
});
test('diagrams and tables use supplied data and never increase the question count',()=>{
 const illustrated=all.filter(q=>q.figure);assert.equal(illustrated.length,15);
 for(const q of illustrated){const f=q.figure;if(['triangle','rectangle'].includes(f.type)){assert.ok(f.horizontal>0&&f.vertical>0);assert.equal(f.labels.length,3);assert.ok(f.labels.some(s=>s.includes('?')));}else if(f.type==='reflection')assert.ok(f.mirrorAngle>0&&f.mirrorAngle<90);else{assert.equal(f.type,'table');assert.equal(f.rows.length,2);assert.ok(f.rows.every(r=>r.length===f.headings.length));}}
});

test('hemisphere cases distinguish longitude labels from east-west hemispheres',()=>{
 const bank=lessons.find(l=>l.title==='经纬网定位').exercises;
 for(const [fragment,expected] of [['10°S、170°E','南半球、西半球'],['15°N、10°W','北半球、东半球'],['60°N、170°W','北半球、西半球'],['30°S、40°E','南半球、东半球']])assert.equal(value(bank.find(q=>q.question.includes(fragment))),expected);
 const rice=lessons.find(l=>l.title==='被动语态的基本结构').exercises.find(q=>q.question.startsWith('Rice'));
 assert.match(rice.question,/by local farmers/);assert.equal(value(rice),'is grown');
});
