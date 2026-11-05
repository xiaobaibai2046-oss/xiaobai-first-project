"""Real SDK-only acceptance; never substitutes public feeds or synthetic prices."""
import argparse
import datetime as dt
import importlib.metadata
import json
import os
import subprocess
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from tdx_provider import Provider,TdxError,SH
from market_metrics import metrics

def run(include_pro=False,model_only=False):
    previous_pro=os.environ.get('TDX_ENABLE_PRO');
    if include_pro:os.environ['TDX_ENABLE_PRO']='true'
    provider=Provider(max_calls=4 if model_only else 20);model_inputs={};report={'source':'official SDK only','sdk_version':None,'connected':False,'checked_at':dt.datetime.now(SH).isoformat(),'results':{},'billing':'官方随包文档未提供账号计费单价；未验证权限/积分时不能估算费用','native_requests':0}
    try:report['sdk_version']=importlib.metadata.version('tdxaidata')
    except importlib.metadata.PackageNotFoundError:pass
    if model_only:
        previous=Path(__file__).resolve().parent.parent/'validation'/'tdx-live.json'
        if previous.exists():
            old=json.loads(previous.read_text());report['results']=old.get('results',{});report['prior_checked_at']=old.get('checked_at');report['mode']='model_only';report['note']='Only daily/hourly reread in this run; other interface results retained from prior_checked_at'
    try:
        for code in ('600519','000001'):
            rows=report['results'].setdefault(code,{}) if model_only else {};report['results'][code]=rows
            inputs=model_inputs[code]={'now':dt.datetime.now(SH).isoformat()}
            operations=[('history',{'count':31}),('hourly',{'count':120})] if model_only else [('quote',{}),('history',{'count':31}),('hourly',{'count':120}),('minutes',{'period':'5m','count':30}),('depth',{})]+([('ticks',{}),('funds',{})] if include_pro else [])
            for kind,options in operations:
                try:
                    data=provider.get(kind,code,**options);report['connected']=True
                    if kind in ('history','hourly'):inputs[kind]=data
                    if kind=='history':
                        if len(data['bars'])<30:rows[kind]={'status':'insufficient_rows','received':len(data['bars']),'source':data['source']};continue
                        data['bars']=data['bars'][-30:]
                        rows[kind]={'status':'success','source':data['source'],'first_date':data['bars'][0]['date'],'last_date':data['last_date'],'latest_close':data['bars'][-1]['close'],'latest_volume_shares':data['bars'][-1]['volume_shares'],'metrics':metrics(data['bars']),'sample_bars':data['bars']}
                    elif kind=='quote':rows[kind]={'status':'success','quote':data['quotes'][0],'source':data['source']}
                    elif kind=='depth':rows[kind]={'status':data['depth']['status'],'source':data['source'],'depth':data['depth']}
                    else:rows[kind]={'status':'success','source':data['source'],'rows':len(data.get('bars',[])) if 'bars' in data else None}
                except TdxError as exc:rows[kind]={'status':exc.category,'message':str(exc)}
        if model_only:
            try:
                result=subprocess.run(['node',str(Path(__file__).with_name('verify-tdx-model.mjs'))],input=json.dumps(model_inputs),text=True,capture_output=True,check=True,timeout=30)
                report['model_results']=json.loads(result.stdout)
            except (subprocess.SubprocessError,OSError,ValueError):report['model_results']={'status':'failed','message':'Production model acceptance failed; check real bar availability and Node runtime'}
        report['native_requests']=provider.calls
        return report
    finally:
        provider.close()
        if previous_pro is None:os.environ.pop('TDX_ENABLE_PRO',None)
        else:os.environ['TDX_ENABLE_PRO']=previous_pro

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--include-pro',action='store_true');parser.add_argument('--model-only',action='store_true');parser.add_argument('--output',type=Path);args=parser.parse_args()
    report=run(args.include_pro,args.model_only);text=json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text,encoding='utf-8')
    print(text)
    success=all(row.get('history',{}).get('status')=='success' and row.get('quote',{}).get('status')=='success' for row in report['results'].values())
    if args.model_only:success=success and all(report.get('model_results',{}).get(code,{}).get('status')=='success' for code in ('600519','000001'))
    sys.exit(0 if success else 2)
