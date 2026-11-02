import {expectedSignalTime} from '../signal-model.js';
// Replan after each pass: a list chosen before a market close cannot cover the new completed session.
export async function runScanCycles({plan,scan,deadline,now=()=>new Date(),wait=ms=>new Promise(r=>setTimeout(r,ms)),onBackoff=()=>{},stopped=()=>false}){
 const attempted=new Set();let failures=0,passes=0;
 while(!stopped()&&now().getTime()<deadline){
  const time=now(),session=expectedSignalTime(time,'daily')+'|'+expectedSignalTime(time);
  const candidates=plan(time).filter(s=>!attempted.has(session+'|'+s.code));
  if(!candidates.length)break;
  const result=await scan(candidates);passes++;
  for(const code of result.codes)attempted.add(session+'|'+code);
  if(result.status==='source_unavailable'){
   const delay=30000*2**failures++;
   if(failures>3||now().getTime()+delay>=deadline)break;
   onBackoff(delay,failures);await wait(delay);
  }else if(result.status==='paused')break;
 }
 return passes;
}
