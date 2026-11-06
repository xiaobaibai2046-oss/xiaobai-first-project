"""Separate GitHub workflow dispatch path. No market credentials or market requests."""
import json
import os
from pathlib import Path
import subprocess
import sys
sys.path.insert(0,str(Path(__file__).parent))
# Use the preflight output from the immediately preceding step.
repo=os.environ['GITHUB_REPOSITORY']
base='repos/'+repo+'/actions/workflows/stock-signals.yml'
r=subprocess.run(['gh','api',base+'/runs?branch=main&per_page=20'],capture_output=True,text=True,check=True)
runs=json.loads(r.stdout)['workflow_runs']
active={'queued','in_progress','waiting','requested','pending'}
if any(run['status'] in active for run in runs):
    print('::notice::Watchdog found an active or queued main scan; no duplicate request.')
else:
    payload=json.dumps({'ref':'main','inputs':{'trigger_source':'github_watchdog'}})
    subprocess.run(['gh','api','--method','POST',base+'/dispatches','--input','-'],input=payload,text=True,check=True)
    print('::notice::Watchdog requested the original scan through workflow_dispatch; the main preflight still enforces retry and freshness limits.')
