import {add} from './quality-bank.js';
// Rows: exact concept title | concrete prompt | correct option | three distractors | reasoning.
export function readCases(raw){for(const line of raw.trim().split('\n')){if(!line.trim())continue;const [title,question,right,w1,w2,w3,explanation,...rest]=line.split('|');if(rest.length||!explanation)throw new Error('Malformed case: '+line);add(title,question,[right,w1,w2,w3],0,explanation,'材料 / 情境分析');}}
