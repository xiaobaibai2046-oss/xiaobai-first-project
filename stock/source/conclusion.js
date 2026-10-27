import {analyzeHourlyMACD,makeTradeHints} from './macd.js';
import {analyze} from './indicators.js';
import {backtest,financialAnalysis} from './research.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function summarizeStock({code,quote=null,history=null,hourly=null,financial=null,errors={},now=new Date()}){
 for(const data of [quote,history,hourly,financial])if(data&&data.code!==code)throw Error('数据代码不一致，已停止合并分析');
 const missing=[],risks=[],reasons=[];let technical=null,macd=null,simulation=null,simulationNote='日线不足，回测未运行';
 const report=financial?.reports?.[0]||null;
 const age=date=>(now.getTime()-Date.parse(date))/86400000;
 const validReport=!!report&&finite(report.profit)&&finite(report.revenue)&&finite(report.revenue_yoy)&&finite(report.profit_yoy)&&!!report.notice_date&&Number.isFinite(age(report.period))&&age(report.period)>=0&&age(report.period)<=240&&Number.isFinite(age(report.notice_date))&&age(report.notice_date)>=0;
 const quoteOK=!!quote&&finite(quote.price)&&quote.price>0&&Number.isFinite(age(quote.exchange_time))&&age(quote.exchange_time)>=-1/1440&&age(quote.exchange_time)<=10;
 if(!quoteOK)missing.push('有效且近期的报价');
 if(!validReport)missing.push('近期、包含公告日期及盈利增长数据的财报');
 if(history?.bars?.length>=20){try{technical=analyze(history.bars)}catch(e){missing.push('可计算的日线')}}else missing.push('至少 20 根已完成日线');
 if(technical&&(!Number.isFinite(age(technical.date))||age(technical.date)<0||age(technical.date)>10))missing.push('近期日线（现有日线超过 10 个自然日或日期异常）');
 if(technical&&history.bars.at(-1).volume===0)missing.push('末根日线零成交量，需核查停牌或数据');
 const name=quote?.name||report?.name||history?.name||code;
 const special=/^(?:\*)?ST|退市|退$/i.test(name);
 const financialSector=/银行|保险|证券|金融/.test(report?.industry||'');
 const cashKnown=!!report&&finite(report.eps)&&report.eps>0&&finite(report.ocf_per_share);
 const cashRatio=cashKnown?report.ocf_per_share/report.eps:null;
 if(!financialSector&&!cashKnown)missing.push('可比较的正 EPS 与每股经营现金流');
 if(special)risks.push('名称带有 ST 或退市相关标识，需优先核查交易与退市风险');
 if(report){
  if(finite(report.profit)&&report.profit<=0)risks.push(`截至 ${report.period} 累计归母利润不为正`);
  for(const [key,title] of [['revenue_yoy','营收'],['profit_yoy','净利润']])if(finite(report[key]))(report[key]<0?risks:reasons).push(`${title}同比 ${report[key].toFixed(2)}%（${report.period} 累计口径）`);
  if(!financialSector&&cashRatio!==null){if(cashRatio<.8)risks.push(`经营现金流与 EPS 的粗略匹配比值 ${cashRatio.toFixed(2)}，低于研究阈值 0.8`);else reasons.push(`每股经营现金流 / EPS 为 ${cashRatio.toFixed(2)}，仍需核查口径与季节性`)}
  if(financialSector)reasons.push('金融行业不套用一般企业现金流阈值，需要行业专门估值');
 }
 reasons.unshift(finite(report?.roe)?`ROE（净资产收益率）${report.roe.toFixed(2)}%（截至 ${report.period||'报告期未取得'}，累计口径，未年化）`:'ROE（净资产收益率）：数据缺失，暂不评价');
 if(technical){
  if(technical.trend)reasons.push('收盘价 > MA20，满足预设趋势规则');else risks.push('尚未满足“收盘价 > MA20”的趋势规则');
  if(technical.atr/technical.close>.04)risks.push('ATR 超过收盘价的 4%，近期波动较大');
  if(history.bars.length>=22&&/^(60|00)\d{4}$/.test(code)&&!special){try{simulation=backtest(history.bars,{capital:1000000});simulationNote='仅 MA20 日线基准实验，未包含60分钟MACD；100 万元假设账户，单笔风险 0.5%，不复权价格实验'}catch(e){simulationNote=e.message}}else simulationNote='该板块、风险标识或日线数量不在首版回测支持范围';
 }
 let hourlyFresh=false;
 if(hourly?.bars?.length>=100){try{macd=analyzeHourlyMACD(hourly.bars);hourlyFresh=age(macd.asOf)>=0&&age(macd.asOf)<=10;if(!hourlyFresh)missing.push('近期的60分钟K线')}catch(e){missing.push(e.message)}}else missing.push('至少100根已完成60分钟K线');
 const dailyFresh=!!technical&&age(technical.date)>=0&&age(technical.date)<=10;
 let status='incomplete',title='数据不足，暂不下结论',action='缺失项目补齐后再判断；本次没有生成买入指令。';
 if(special||(validReport&&report.profit<=0)){status='risk';title='风险较高，暂不列入优先研究';action=special?'先核查风险警示、财务和交易状态，不依据技术信号追入。':'近期财报显示累计归母利润不为正，先核查亏损原因和持续经营能力。'}
 else if(!missing.length){
  if(report.profit<=0||(report.revenue_yoy<0&&report.profit_yoy<0&&!technical.trend)){
   status='risk';title='风险较高，暂不列入优先研究';action='盈利或经营趋势存在明显弱项，先等待财报或趋势改善。';
  }else if(technical.trend&&report.revenue_yoy>=0&&report.profit_yoy>=0&&!financialSector&&cashRatio>=.8&&technical.atr/technical.close<=.04){
   status='watch';title='可列入观察，值得进一步研究';action='基本面摘要与趋势规则同向；估值、公告和个人风险约束核查后再决定是否交易。';
  }else{status='caution';title='谨慎观察，暂不追入';action='财务与趋势条件尚未充分同向，先关注下列弱项和后续变化。'}
 }
 const tradeHints=makeTradeHints({technical,macd,dailyFresh,hourlyFresh,blocked:[...missing,...(status==='risk'?['基本面或风险警示']:[])]});
 return {macd,tradeHints,code,name,status,title,action,missing,risks,reasons,quote,report,technical,simulation,simulationNote,errors,financialChecks:report?financialAnalysis(report):null,
  valuation:quote&&finite(quote.pe_ttm)&&quote.pe_ttm>0?`当前供应商 PE(TTM) ${quote.pe_ttm.toFixed(2)} 倍；缺少行业可比估值和未来盈利假设，不能据此判断便宜或昂贵。`:'未取得有效正 PE(TTM)；没有生成估值或目标价。',
  generatedAt:now.toISOString()};
}
