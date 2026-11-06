"""Bounded same-day wait; uses the process clock, never a second workflow event."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sys
import time
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parent.parent;sys.path.insert(0,str(ROOT))
from trading_sessions import is_trading_day
SH=ZoneInfo('Asia/Shanghai')
parser=argparse.ArgumentParser();parser.add_argument('--slot',choices=['14:05','15:05'],required=True);args=parser.parse_args()
r=json.loads((ROOT/'validation/remaining-slots-request.json').read_text());now=dt.datetime.now(SH);date=r['date']
ready=now.date().isoformat()==date and is_trading_day(now.date()) and now.strftime('%H:%M')<'15:20'
if ready:
    target=dt.datetime.fromisoformat(date+'T'+args.slot+':00+08:00')
    if (target-now).total_seconds()>3*3600:raise RuntimeError('Recovery wait exceeds its bounded window')
    print('::notice::Process-clock wait active for '+target.isoformat()+'; next steps are already in this push-triggered workflow.',flush=True)
    started=time.monotonic();tested=False
    while dt.datetime.now(SH)<target:
        if not tested and time.monotonic()-started>=90:
            print('::notice::90-second process-clock wakeup test passed; no market calls.',flush=True);tested=True
        time.sleep(min(20,max(0,(target-dt.datetime.now(SH)).total_seconds())))
    print('::notice::Target reached at '+dt.datetime.now(SH).isoformat(),flush=True)
else:print('::notice::Recovery date/window is no longer current; paid collection skipped.',flush=True)
with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('ready='+str(ready).lower()+'\n')
