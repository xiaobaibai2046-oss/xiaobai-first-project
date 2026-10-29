import {practiceFor} from '../practice/index.js';
import {mathNotes} from './math.js';
import {chineseNotes} from './chinese.js';
import {englishNotes} from './english.js';
import {physicsNotes} from './physics.js';
import {chemistryNotes} from './chemistry.js';
import {biologyNotes} from './biology.js';
import {historyNotes} from './history.js';
import {geographyNotes} from './geography.js';
import {ethicsNotes} from './ethics.js';
const packs={math:mathNotes,chinese:chineseNotes,english:englishNotes,physics:physicsNotes,chemistry:chemistryNotes,biology:biologyNotes,history:historyNotes,geography:geographyNotes,ethics:ethicsNotes};
// IDs are append-only within each subject. Do not reorder existing rows on future expansion.
function parseNotes(subject,raw){
 let grade,unit,index=0;
 return raw.trim().split('\n').filter(Boolean).flatMap(line=>{
  if(line.startsWith('@')){const [g,u]=line.slice(1).split('|');grade=Number(g);unit=u;return [];}
  const [title,body,...extra]=line.split('|');
  if(![7,8,9].includes(grade)||!unit||!title||!body||extra.length)throw new Error(`Invalid content row: ${subject} / ${title}`);
  const note={id:`foundation-${subject}-${++index}`,subject,grade,unit,title,body,minutes:4,contentFormat:'concept-note',reviewPrompt:`不看讲解，用自己的话解释“${title}”，并举一个例子或说明适用条件。`};
  return [{...note,...practiceFor(note)}];
 });
}
export const foundationLessons=Object.entries(packs).flatMap(([subject,raw])=>parseNotes(subject,raw));
