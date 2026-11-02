"""Optional bounded disk cache for cloud scans, never caches errors or future bars."""
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
from zoneinfo import ZoneInfo
SH=ZoneInfo('Asia/Shanghai')
def expected(now,kind):
    local=now.astimezone(SH);day=local.date();minute=local.hour*60+local.minute
    if kind=='history':
        if day.weekday()<5 and minute>=960:return day.isoformat()
    elif kind=='hourly' and day.weekday()<5:
        closed=[x for x in (630,690,840,900) if x<=minute]
        if closed:return day.isoformat()+f'T{closed[-1]//60:02d}:{closed[-1]%60:02d}:00+08:00'
    while True:
        day-=dt.timedelta(days=1)
        if day.weekday()<5:break
    return day.isoformat() if kind=='history' else day.isoformat()+'T15:00:00+08:00'
def _encoded(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')
def load_cached(root,kind,code,loader,now=None):
    if not root or kind not in ('history','hourly','financial'):return loader()
    if not re.fullmatch(r'\d{6}',code):raise ValueError('invalid cache code')
    now=now or dt.datetime.now(SH);path=Path(root)/(kind+'-'+code+'.json')
    def valid(data,saved_at):
        if not isinstance(data,dict) or data.get('code')!=code or not 0<=now.timestamp()-saved_at<=172800:return False
        if kind in ('history','hourly'):
            bars=data.get('bars');field='date' if kind=='history' else 'endTime'
            return bool(isinstance(bars,list) and bars and data.get('adjustment')=='none' and bars[-1].get(field)==expected(now,kind))
        return now.timestamp()-saved_at<3600 and bool(data.get('reports'))
    try:
        record=json.loads(path.read_text(encoding='utf-8'));data=record['data']
        if record['version']==1 and hashlib.sha256(_encoded(data)).hexdigest()==record['sha256'] and valid(data,record['saved_at']):return dict(data,cloud_cache_hit=True)
    except (OSError,ValueError,KeyError,TypeError,AttributeError):pass
    data=loader()  # Failures are deliberately not cached.
    if valid(data,now.timestamp()):
        try:
            path.parent.mkdir(parents=True,exist_ok=True)
            record={'version':1,'saved_at':now.timestamp(),'data':data,'sha256':hashlib.sha256(_encoded(data)).hexdigest()}
            temp=path.with_suffix('.tmp');temp.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8');os.replace(temp,path)
        except OSError:
            pass  # An unavailable cache must never prevent a successful scan.
    return dict(data,cloud_cache_hit=False)
