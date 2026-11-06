"""Cheap scheduled preflight: one scan per target slot, with late-run recovery."""
import datetime as dt
import json
import os
from pathlib import Path
import sys
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from trading_sessions import is_trading_day

SH=ZoneInfo('Asia/Shanghai')

def scan_due(snapshot,pool,now):
    now=now.astimezone(SH)
    if not is_trading_day(now.date()):return {'run':False,'reason':'exchange_closed'}
    minute=now.hour*60+now.minute
    slots=[(635,'10:30'),(695,'11:30'),(845,'14:00'),(905,'15:00')]
    eligible=[slot for slot in slots if minute>=slot[0]]
    if not eligible:return {'run':False,'reason':'before_first_update'}
    target=now.date().isoformat()+'T'+eligible[-1][1]+':00+08:00'
    results=snapshot.get('results',{});stocks=pool.get('stocks',[])
    checked=sum(results.get(s['code'],{}).get('checked_session')==target for s in stocks)
    valid=sum(results.get(s['code'],{}).get('checked_session')==target and results.get(s['code'],{}).get('hourly_as_of')==target for s in stocks)
    # A small, explicitly incomplete tail must not cause repeated paid full-pool runs.
    complete=bool(stocks) and checked==len(stocks) and valid/len(stocks)>=0.95
    return {'run':not complete,'reason':'slot_already_checked' if complete else 'target_slot_not_verified','target':target,'checked':checked,'hourly_current':valid,'pool_size':len(stocks)}

if __name__=='__main__':
    root=Path(__file__).resolve().parent.parent
    result=scan_due(json.loads((root/'pool-signals.json').read_text()),json.loads((root/'pool-2025.json').read_text()),dt.datetime.now(SH))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('run='+str(result['run']).lower()+'\n')
    print(json.dumps(result,ensure_ascii=False))
