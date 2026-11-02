// Observed Dazhihui 365 single-stock DAD layout; unsupported layouts fail closed.
// Timestamp integer encodes Shanghai wall-clock fields as UTC-shaped seconds:
// 09:35 in the sample is 09:35 Shanghai, NOT 17:35 Shanghai.
export function parseDzhDad(input,{now=new Date(),skipInvalid=false}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.byteLength<112||bytes.byteLength>8*1024*1024)throw Error('DAD文件长度不支持');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u32=i=>view.getUint32(i,true);
 if(u32(0)!==0x33fc198c||u32(8)!==1||u32(16)!==0xffffffff||(bytes.length-80)%32!==0)throw Error('仅支持已验证的单只股票DAD布局，请只导出一只股票');
 const period=u32(12);if(period!==0&&period!==1)throw Error('DAD周期不支持，仅验证过日线与5分钟线');
 const footer=bytes.length-32;if(u32(footer)!==0xffffffff||bytes.slice(footer+4).some(x=>x!==0))throw Error('DAD结束标记不完整，文件可能仍在生成');
 const symbol=new TextDecoder('ascii').decode(bytes.slice(20,32)).split('\0')[0];if(!/^(SH(?:60|68)\d{4}|SZ(?:00|30)\d{4}|BJ(?:43|83|87|92)\d{4})$/.test(symbol))throw Error('DAD代码或市场字段不支持');
 const code=symbol.slice(2),bars=[],issues=[],seen=new Set(),groups=new Map();let unfinished=0;
 const clock=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));const today=`${clock.year}-${clock.month}-${clock.day}`;
 for(let off=48,index=1;off<footer;off+=32,index++){
  try{
   const stamp=new Date(u32(off)*1000);if(stamp.getUTCFullYear()<2000||stamp.getUTCFullYear()>2099||stamp.getUTCSeconds()!==0)throw Error('时间戳不支持');
   const day=stamp.toISOString().slice(0,10),minute=stamp.getUTCHours()*60+stamp.getUTCMinutes();
   if(period===0?minute!==0:minute%5!==0||!(minute>=575&&minute<=690||minute>=785&&minute<=900))throw Error('周期或交易时段不支持');
   const key=stamp.toISOString();if(seen.has(key))throw Error('重复K线');seen.add(key);
   const values=Array.from({length:6},(_,i)=>view.getFloat32(off+4+i*4,true));let [open,high,low,close,volume,amount]=values;
   if(values.some(x=>!Number.isFinite(x))||Math.min(open,high,low,close)<=0||volume<0||amount<0||high<Math.max(open,close)||low>Math.min(open,close))throw Error('价格、成交量或成交额无效');
   // float32 prices contain storage noise; accept only prices compatible with cents.
   for(const price of [open,high,low,close])if(Math.abs(price-Math.round(price*100)/100)>0.0001)throw Error('价格精度超出已验证的A股分单位');
   [open,high,low,close]=[open,high,low,close].map(x=>Math.round(x*100)/100);
   const time=day+'T'+stamp.toISOString().slice(11,16)+':00+08:00';
   if(period===0?day>today||day===today&&+clock.hour<16:Date.parse(time)>now.getTime()){unfinished++;continue}
   const bar={code,name:code,open,high,low,close,volume,amount};
   if(period===0)bars.push({...bar,date:day});else{
    const end=minute<=630?630:minute<=690?690:minute<=840?840:900,groupKey=day+'T'+String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0')+':00+08:00';
    if(!groups.has(groupKey))groups.set(groupKey,{end,items:[]});groups.get(groupKey).items.push({...bar,minute});
   }
  }catch(e){issues.push({record:index,offset:off,message:e.message})}
 }
 if(issues.length&&!skipInvalid)throw Error(`DAD有${issues.length}条异常，第${issues[0].record}条：${issues[0].message}；请修正或明确选择跳过异常行`);
 const incomplete=[];
 if(period===1)for(const [time,{end,items}] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  items.sort((a,b)=>a.minute-b.minute);
  if(items.length!==12||items.some((b,i)=>b.minute!==end-55+i*5)){incomplete.push({endTime:time,records:items.length});continue}
  if(Date.parse(time)>now.getTime()){incomplete.push({endTime:time,records:items.length});continue}
  bars.push({code,name:code,endTime:time,open:items[0].open,high:Math.max(...items.map(b=>b.high)),low:Math.min(...items.map(b=>b.low)),close:items.at(-1).close,volume:items.reduce((s,b)=>s+b.volume,0),amount:items.reduce((s,b)=>s+b.amount,0)});
 }
 if(!bars.length)throw Error('DAD没有有效已完成K线；5分钟合成需要每组完整12根');
 bars.sort((a,b)=>(a.date||a.endTime).localeCompare(b.date||b.endTime));
 const kind=period===0?'history':'hourly';
 return {code,name:code,kind,bars,adjustment:'none',source:period===0?'大智慧DAD日线文件 · 用户确认不复权（非实时接口）':'大智慧DAD 5分钟合成60分钟 · 用户确认不复权（非实时接口）',fetched_at:now.toISOString(),...(period===0?{first_date:bars[0].date,last_date:bars.at(-1).date}:{timeframe:'60m',last_time:bars.at(-1).endTime}),import_report:{valid:bars.length,input_records:(bytes.length-80)/32,input_period:period===0?'日线':'5分钟',unfinished,issues,incomplete_groups:incomplete,volume_unit:'导出原值，单位待核对'}};
}
