"""Query only the 51 missing annual ROEs plus one known control; never substitute public data."""
import datetime as dt
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
from tdx_provider import Provider,TdxError
from tdx_annual_roe import extract_annual_roe

pool=json.loads((ROOT/'pool-2025.json').read_text());missing=pool.get('missing_roe_stocks',[])
provider=Provider(max_calls=60)
report={'field':'FN281','metric':'2025年年报加权净资产收益率（%）','source':'通达信官方 TdxAiData','report_date':'2025-12-31','before_missing':len(missing),'filled':0,'newly_qualified':[],'results':[],'control':{}}
report['controls']={}
try:
    for exchange,preferred in [('SH','600519'),('SZ','000333'),('BJ','920005')]:
        candidates=[s for s in pool['stocks'] if s['exchange']==exchange]
        control=next((s for s in candidates if s['code']==preferred),candidates[0] if candidates else None)
        if not control:report['controls'][exchange]={'status':'missing_control'};continue
        try:
            value=extract_annual_roe(provider.raw('annual_finance',control['code']),control['code'])
            if abs(value-control['roe'])>0.0001:raise TdxError('schema')
            report['controls'][exchange]={'code':control['code'],'status':'matched','roe':value}
        except TdxError as exc:report['controls'][exchange]={'code':control['code'],'status':exc.category,'reason':str(exc)}
    report['control']=report['controls'].get('SH',{})
    remaining=[]
    for stock in missing:
        item={'code':stock['code'],'name':stock['name']}
        if report['controls'].get(stock['exchange'],{}).get('status')!='matched':
            item['status']='not_requested_control_failed';remaining.append(stock)
        else:
            try:
                value=extract_annual_roe(provider.raw('annual_finance',stock['code']),stock['code'])
                # Native financial packages may encode unavailable ratios as 0. Do not claim a fill without independent evidence.
                if value==0:
                    item.update(status='zero_unverified',roe=0);remaining.append(stock)
                else:
                    item.update(status='verified',roe=value);report['filled']+=1
                    pool['stats']['missing_roe']-=1
                    if value>10:
                        qualified={k:stock.get(k) for k in ('code','name','report_date','notice_date','exchange','market','industry')}
                        qualified.update(roe=value,roe_source='通达信官方 FN281；2025年年报')
                        pool['stocks'].append(qualified);report['newly_qualified'].append(qualified)
                    else:pool['stats']['not_above_threshold']+=1
            except TdxError as exc:
                item.update(status=exc.category,reason=str(exc));remaining.append(stock)
        report['results'].append(item)
    report['sdk_calls']=provider.calls;report['remaining_missing']=len(remaining);report['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    if report['filled']:
        pool['stocks'].sort(key=lambda s:(-s['roe'],s['code']));pool['stats']['qualified']=len(pool['stocks']);pool['missing_roe_stocks']=remaining;pool['as_of']=report['updated_at'];pool['tdx_roe_backfill']={'field':'FN281','year':2025,'filled':report['filled']}
        assert pool['stats']['covered_a_shares']==pool['stats']['qualified']+pool['stats']['missing_roe']+pool['stats']['not_above_threshold']
        (ROOT/'pool-2025.json').write_text(json.dumps(pool,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (ROOT/'validation/tdx-roe-backfill.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('control','filled','remaining_missing','sdk_calls')},ensure_ascii=False))
finally:provider.close()
