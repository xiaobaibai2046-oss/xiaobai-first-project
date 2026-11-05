"""Real SDK-only acceptance; never substitutes public feeds or synthetic prices."""
import argparse
import datetime as dt
import importlib.metadata
import json
import os
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from tdx_provider import Provider,TdxError,SH
from market_metrics import metrics

def run(include_pro=False):
    previous_pro=os.environ.get('TDX_ENABLE_PRO');
    if include_pro:os.environ['TDX_ENABLE_PRO']='true'
    provider=Provider(max_calls=20);report={'source':'official SDK only','sdk_version':None,'connected':False,'checked_at':dt.datetime.now(SH).isoformat(),'results':{},'billing':'官方随包文档未提供账号计费单价；未验证权限/积分时不能估算费用','native_requests':0}
    try:report['sdk_version']=importlib.metadata.version('tdxaidata')
    except importlib.metadata.PackageNotFoundError:pass
    try:
        for code in ('600519','000001'):
            rows=report['results'][code]={}
            for kind,options in [('quote',{}),('history',{'count':31}),('hourly',{'count':120}),('minutes',{'period':'5m','count':30}),('depth',{})]+([('ticks',{}),('funds',{})] if include_pro else []):
                try:
                    data=provider.get(kind,code,**options);report['connected']=True
                    if kind=='history':
                        if len(data['bars'])<30:rows[kind]={'status':'insufficient_rows','received':len(data['bars']),'source':data['source']};continue
                        data['bars']=data['bars'][-30:]
                        rows[kind]={'status':'success','source':data['source'],'first_date':data['bars'][0]['date'],'last_date':data['last_date'],'latest_close':data['bars'][-1]['close'],'latest_volume_shares':data['bars'][-1]['volume_shares'],'metrics':metrics(data['bars']),'sample_bars':data['bars']}
                    elif kind=='quote':rows[kind]={'status':'success','quote':data['quotes'][0],'source':data['source']}
                    elif kind=='depth':rows[kind]={'status':data['depth']['status'],'source':data['source'],'depth':data['depth']}
                    else:rows[kind]={'status':'success','source':data['source'],'rows':len(data.get('bars',[])) if 'bars' in data else None}
                except TdxError as exc:rows[kind]={'status':exc.category,'message':str(exc)}
        report['native_requests']=provider.calls
        return report
    finally:
        provider.close()
        if previous_pro is None:os.environ.pop('TDX_ENABLE_PRO',None)
        else:os.environ['TDX_ENABLE_PRO']=previous_pro

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--include-pro',action='store_true');parser.add_argument('--output',type=Path);args=parser.parse_args()
    report=run(args.include_pro);text=json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text,encoding='utf-8')
    print(text)
    success=all(row.get('history',{}).get('status')=='success' and row.get('quote',{}).get('status')=='success' for row in report['results'].values())
    sys.exit(0 if success else 2)
