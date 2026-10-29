import {mathChecks} from './math.js';
import {chineseChecks} from './chinese.js';
import {englishChecks} from './english.js';
import {physicsChecks} from './physics.js';
import {chemistryChecks} from './chemistry.js';
import {biologyChecks} from './biology.js';
import {historyChecks} from './history.js';
import {geographyChecks} from './geography.js';
import {ethicsChecks} from './ethics.js';
const packs={math:mathChecks,chinese:chineseChecks,english:englishChecks,physics:physicsChecks,chemistry:chemistryChecks,biology:biologyChecks,history:historyChecks,geography:geographyChecks,ethics:ethicsChecks};
const checks=new Map();
for(const [subject,raw] of Object.entries(packs))for(const line of raw.trim().split('\n')){
 const [title,truth,statement,...extra]=line.split('|');
 if(!title||!['T','F'].includes(truth)||!statement||extra.length)throw new Error(`Invalid practice: ${subject}/${title}`);
 const key=subject+':'+title;if(checks.has(key))throw new Error(`Duplicate practice: ${key}`);
 checks.set(key,{truth:truth==='T',statement});
}
export function practiceFor(note){
 const check=checks.get(note.subject+':'+note.title);if(!check)throw new Error(`Missing practice: ${note.subject}/${note.title}`);
 // Alternate the option order by a stable hash; answer positions are not a subject-wide constant.
 const reverse=[...note.id].reduce((sum,c)=>sum+c.codePointAt(0),0)%2===1;
 const options=reverse?['表述错误','表述正确']:['表述正确','表述错误'];
 const answer=options.indexOf(check.truth?'表述正确':'表述错误');
 return {question:`判断下面的表述是否正确：\n${check.statement}`,options,answer,explanation:`这段表述${check.truth?'正确':'错误'}。\n关键依据：${note.body}`,hint:note.body.split(/[。！？]/)[0]+'。',questionType:'concept-check',checkTruth:check.truth,checkStatement:check.statement};
}
export const practiceCount=checks.size;
