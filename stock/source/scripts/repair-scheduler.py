"""Re-register only the two explicit stock timers and audit the actual API outcomes."""
import datetime as dt
import json
import os
from pathlib import Path
import subprocess

repo=os.environ['GITHUB_REPOSITORY'];base='repos/'+repo
report={'at':dt.datetime.now(dt.timezone.utc).isoformat(),'workflows':[]}
def api(path,method='GET'):
    p=subprocess.run(['gh','api','--method',method,path],capture_output=True,text=True)
    if p.returncode:raise RuntimeError('GitHub API '+method+' '+path+' failed; inspect authenticated workflow logs for the HTTP status')
    return json.loads(p.stdout) if p.stdout.strip() else {}
metadata=api(base);report['default_branch']=metadata.get('default_branch');report['archived']=metadata.get('archived')
if report['default_branch']!='main' or report['archived']:raise RuntimeError('Unexpected repository state; settings left unchanged')
for workflow in ['stock-signals.yml','stock-watchdog.yml']:
    endpoint=base+'/actions/workflows/'+workflow
    before=api(endpoint)
    api(endpoint+'/disable','PUT');api(endpoint+'/enable','PUT')
    after=api(endpoint)
    report['workflows'].append({'file':workflow,'id':after['id'],'before':before['state'],'after':after['state']})
    if after['state']!='active':raise RuntimeError('Workflow did not re-enable')
    print('::notice::Re-enabled '+workflow+'; API state='+after['state'])
report['natural_schedule_verified']=False
Path('stock/source/validation/scheduler-repair.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# This explicitly tests the dispatch path, not the natural clock.
subprocess.run(['gh','api','--method','POST',base+'/actions/workflows/stock-watchdog.yml/dispatches','-f','ref=main'],check=True)
print('::notice::Manual watchdog validation requested. Natural cron execution must still be observed separately.')
