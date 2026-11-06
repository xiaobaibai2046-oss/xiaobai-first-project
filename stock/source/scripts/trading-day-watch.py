"""One explicitly bounded recovery watch on an existing standard Actions runner.
No self-chaining, no permanent server, no market key, no direct market calls.
"""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('due',ROOT/'scripts/scan-due.py');due=importlib.util.module_from_spec(spec);spec.loader.exec_module(due)
SH=ZoneInfo('Asia/Shanghai');repo=os.environ['GITHUB_REPOSITORY']
if not re.fullmatch(r'[\w.-]+/[\w.-]+',repo):raise ValueError('Invalid repository')
request=json.loads((ROOT/'validation/trading-day-watch-request.json').read_text());date=request['date'];now=dt.datetime.now(SH)
if now.date().isoformat()!=date:raise RuntimeError('Recovery watch is authorised for one explicit trading date only')
end=dt.datetime.fromisoformat(date+'T15:20:00+08:00')
if end<=now:print('Recovery date is finished; no requests.');raise SystemExit(0)
if (end-now).total_seconds()>5.9*3600:raise RuntimeError('One-day watch must stay within the standard runner job limit')
rule=re.search(r"export const SIGNAL_RULE='([^']+)'",(ROOT/'signal-model.js').read_text())[1]
base='repos/'+repo+'/actions/workflows/stock-signals.yml';raw='https://raw.githubusercontent.com/'+repo+'/main/stock/source/'
pool=json.loads((ROOT/'pool-2025.json').read_text());attempts={};last_notice=None;start=time.monotonic();clock_tested=False

def public_json(name):
    url=raw+name+'?watch='+str(int(time.time()))
    with urllib.request.urlopen(url,timeout=20) as response:body=response.read(8_000_001)
    if len(body)>8_000_000:raise RuntimeError('Snapshot too large')
    return json.loads(body)

print('::notice::Bounded process-clock watch is running for '+date+'; update targets 14:05 and 15:05 Beijing; exits by 15:20. No cron event is needed to reach those targets.',flush=True)
while dt.datetime.now(SH)<end:
    now=dt.datetime.now(SH)
    if not clock_tested and time.monotonic()-start>=90:
        print('::notice::Process-clock wakeup self-test passed after 90 seconds; no market requests used.',flush=True);clock_tested=True
    try:
        snapshot=public_json('pool-signals.json')
        if snapshot.get('counts',{}).get('all')!=len(pool.get('stocks',[])):pool=public_json('pool-2025.json')
        decision=due.scan_due(snapshot,pool,now,rule)
        target=decision.get('target');status=decision['reason']
        if decision['run']:
            active=json.loads(subprocess.run(['gh','api',base+'/runs?branch=main&per_page=20'],capture_output=True,text=True,check=True).stdout)['workflow_runs']
            if any(r['status'] in ('queued','in_progress','waiting','requested','pending') for r in active):status='existing_scan_active'
            elif attempts.get(target,0)>=2:status='watch_retry_limit_reached'
            else:
                subprocess.run(['gh','api','--method','POST',base+'/dispatches','--input','-'],input=json.dumps({'ref':'main','inputs':{'trigger_source':'github_watchdog'}}),text=True,check=True)
                attempts[target]=attempts.get(target,0)+1;status='dispatch_accepted'
        notice=(target,status)
        if notice!=last_notice:
            print('::notice::'+json.dumps({'time':now.isoformat(),'target':target,'status':status,'requests_for_target':attempts.get(target,0)},ensure_ascii=False),flush=True);last_notice=notice
    except Exception as exc:
        print('::warning::Recovery watch inspection unavailable: '+type(exc).__name__+'; no blind dispatch.',flush=True)
    time.sleep(20)
print('::notice::Bounded trading-day recovery watch finished; it does not relaunch itself.',flush=True)
