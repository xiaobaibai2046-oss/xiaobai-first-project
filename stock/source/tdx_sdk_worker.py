"""Isolated official SDK process. Native output never reaches RPC or application logs."""
import configparser
import ctypes
import importlib.metadata
import json
import os
from pathlib import Path
import re
import sys
import tempfile


def redact(value):
    if isinstance(value, dict):
        return {k: redact(v) for k,v in value.items() if not re.search(r'token|secret|password|key',str(k),re.I)}
    if isinstance(value,list):return [redact(x) for x in value]
    if isinstance(value,str):return re.sub(r'TDX-[A-Za-z0-9]+','[REDACTED]',value)
    return value


def configure():
    """Apply a process secret to the official package INI, never to a repository file."""
    target=Path(importlib.metadata.distribution('tdxaidata').locate_file('tdxaidata/lib/TdxAiData.ini'))
    cfg=configparser.ConfigParser();cfg.read(target,encoding='utf-8')
    key=os.environ.get('TDX_DATA_KEY','').strip()
    if not key and os.environ.get('TDX_CONFIG_FILE'):
        supplied=configparser.ConfigParser();supplied.read(os.environ['TDX_CONFIG_FILE'],encoding='utf-8')
        key=supplied.get('Token','token',fallback='').strip()
    if not key:raise RuntimeError('TDX credentials missing')
    if not cfg.has_section('Token'):cfg.add_section('Token')
    cfg.set('Token','token',key)
    fd,name=tempfile.mkstemp(dir=target.parent,prefix='.tdx-config-')
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as f:cfg.write(f)
        os.chmod(name,0o600);os.replace(name,target)
    finally:
        if os.path.exists(name):os.unlink(name)


def plain(value):
    # Preserve pandas timestamps, which SDK's non-pandas shape drops.
    if hasattr(value,'columns') and hasattr(value,'index'):
        return {'index':[str(x) for x in value.index], 'columns':{str(k):[None if str(x)=='nan' else x.item() if hasattr(x,'item') else x for x in value[k]] for k in value.columns}}
    if isinstance(value,dict):return {str(k):plain(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [plain(v) for v in value]
    return value


def has_data(value):
    if isinstance(value,dict):return any(has_data(v) for v in value.values())
    if isinstance(value,(list,tuple)):return any(has_data(v) for v in value)
    return value is not None and value!=''


def main():
    out=os.fdopen(os.dup(1),'w',buffering=1)
    # Redirect file descriptors permanently: C/C++ background threads may log outside a call.
    with tempfile.TemporaryFile() as logs:
        os.dup2(logs.fileno(),1);os.dup2(logs.fileno(),2)
        ready=False
        for line in sys.stdin:
            logs.seek(0);logs.truncate()
            try:
                job=json.loads(line)
                if not ready:
                    configure()
                    from tdxaidata import tqs
                    ready=True
                code=job['symbol'];op=job['operation']
                if op=='snapshot':result=tqs.get_market_snapshot(code,[])
                elif op=='bars':result=tqs.get_market_data(field_list=['Open','High','Low','Close','Volume','Amount'],stock_list=[code],period=job['period'],count=job['count'],dividend_type=job.get('adjustment','none'),fill_data=False)
                elif op=='annual_finance':result=tqs.get_financial_data_by_date([code],['FN281'],2025,1231)
                elif op=='ticks':result=tqs.get_tick_data(code,job['date'],0,10)
                elif op=='funds':result=tqs.get_gpjy_value([code],['GP07'],job['date'],job['date'])
                elif op=='calendar':result=tqs.get_trading_dates(code.split('.')[-1],job['start'],job['date'],-1)
                else:raise ValueError('Unsupported operation')
                result=plain(result)
                if not has_data(result):raise RuntimeError('SDK returned empty data')
                packet={'ok':True,'data':redact(result)}
            except Exception as exc:
                # SDK 1.3.1 sometimes prints business errors and returns {} instead of raising.
                sys.stdout.flush();sys.stderr.flush()
                try:ctypes.CDLL(None).fflush(None)
                except Exception:pass
                logs.seek(0);raw=logs.read(65536);text=raw.decode('utf-8',errors='replace')+' '+raw.decode('gb18030',errors='replace')+' '+str(exc)
                from tdx_provider import classify_error
                category='sdk_missing' if isinstance(exc,(ModuleNotFoundError,importlib.metadata.PackageNotFoundError)) else 'not_configured' if not ready and isinstance(exc,(OSError,RuntimeError)) else None
                packet={'ok':False,'error':{'category':category,'message':'官方SDK安装或本地认证配置未完成'} if category else classify_error(text)}
            out.write(json.dumps(packet,ensure_ascii=False,allow_nan=False)+'\n');out.flush()

if __name__=='__main__':main()
