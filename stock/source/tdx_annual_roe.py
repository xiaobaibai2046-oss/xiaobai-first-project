"""Strict annual weighted ROE extraction for the official FN281 by-date endpoint."""
import math
from tdx_provider import symbol,TdxError

def extract_annual_roe(raw,code):
    obj=raw.get('Value',raw) if isinstance(raw,dict) else {}
    entry=obj.get(symbol(code)) if isinstance(obj,dict) else None
    if not isinstance(entry,dict) or 'FN281' not in entry:raise TdxError('schema')
    value=entry['FN281']
    for _ in range(4):
        if isinstance(value,list):
            if len(value)!=1:raise TdxError('schema')
            value=value[0]
        elif isinstance(value,dict):
            date=value.get('Date')
            if date and str(date).replace('-','')[:8]!='20251231':raise TdxError('schema')
            value=value.get('Value')
        else:break
    if value is None or isinstance(value,bool) or str(value).strip() in ('','--','-','None'):raise TdxError('unavailable')
    try:roe=float(value)
    except (TypeError,ValueError):raise TdxError('schema')
    if not math.isfinite(roe) or abs(roe)>=1e30:raise TdxError('unavailable')
    return roe


def reuse_verified_backfill(pool,report):
    """Keep verified same-year official values when a later public refresh still has blanks."""
    if report.get('field')!='FN281' or report.get('report_date')!='2025-12-31' or report.get('source')!='通达信官方 TdxAiData':return 0
    rows={r['code']:r for r in report.get('results',[]) if r.get('status')=='verified'}
    remaining=[];filled=0
    for stock in pool.get('missing_roe_stocks',[]):
        row=rows.get(stock['code']);control=report.get('controls',{}).get(stock['exchange'],{})
        if not row or control.get('status')!='matched':remaining.append(stock);continue
        value=row.get('roe')
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value==0 or abs(value)>=1e30:remaining.append(stock);continue
        filled+=1;pool['stats']['missing_roe']-=1
        if value>10:
            item={k:stock.get(k) for k in ('code','name','report_date','notice_date','exchange','market','industry')};item.update(roe=value,roe_source='通达信官方 FN281；2025年年报',roe_verified_at=report.get('updated_at'));pool['stocks'].append(item)
        else:pool['stats']['not_above_threshold']+=1
    if filled:
        pool['missing_roe_stocks']=remaining;pool['stocks'].sort(key=lambda s:(-s['roe'],s['code']));pool['stats']['qualified']=len(pool['stocks']);pool['tdx_roe_backfill']={'field':'FN281','year':2025,'filled':filled,'verified_at':report.get('updated_at'),'reused_verified_values':True}
        assert pool['stats']['covered_a_shares']==len(pool['stocks'])+pool['stats']['missing_roe']+pool['stats']['not_above_threshold']
    return filled
