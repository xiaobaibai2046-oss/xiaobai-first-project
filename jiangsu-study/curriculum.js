import {subjects,lessons} from './data.js';
export const editions=[{id:'pep',name:'人教版',publisher:'人民教育出版社'},{id:'sujiao',name:'苏教版',publisher:'江苏教育出版社相关教材体系'},{id:'suke',name:'苏科版',publisher:'江苏凤凰科学技术出版社'}];
export const sourceAccess={checkedAt:'2026-10-29',status:'partial-source-access',message:'官方入口仍返回网络代理403；已另从公开镜像读取16册旧版目录，南京五年原卷仍未取得。'};
export const sourceLeads=[
 {title:'人民教育出版社',url:'https://www.pep.com.cn/',purpose:'核对人教版教材版本、出版信息和目录'},
 {title:'人教教材电子资源入口',url:'https://jc.pep.com.cn/',purpose:'查找适用年级与修订版教材目录'},
 {title:'南京市教育局',url:'https://edu.nanjing.gov.cn/',purpose:'核对南京当年考试与课程文件'},
 {title:'南京市招生考试院网站入口',url:'https://www.njzb.net/',purpose:'查找考试信息；是否提供各科原卷仍待确认'}
];
// These are work queues, not assertions that every edition exists for every subject.
export const alignmentQueue=subjects.map(s=>({subject:s.id,lessonIds:lessons.filter(l=>l.subject===s.id).map(l=>l.id),status:lessons.some(l=>l.subject===s.id&&l.textbookRefs.length)?'partial-mirror':'pending',note:s.id==='chinese'||s.id==='history'||s.id==='ethics'?'需先确认统编教材及修订年份，不宜直接套用两套出版社目录。':s.id==='english'?'需区分人教版与译林等具体版本，“江苏使用”不等于“苏教版”。':s.id==='math'||s.id==='physics'?'需区分苏教、苏科等版别及出版信息，不将名称混用。':'需以学校实际教材封面、版权页和目录确认版本。'}));
export function editionRefs(lesson,edition='all'){
 return lesson.textbookRefs.filter(ref=>(edition==='all'||ref.edition===edition)&&['verified','source-read'].includes(ref.status)&&ref.sourceTitle&&ref.locator&&ref.revision&&ref.reviewer&&ref.checkedAt&&ref.sourceUrl?.startsWith('https://'));
}
