"""Cancel one explicitly identified stuck Pages deployment; never collects market data."""
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

request=json.loads(Path('stock/source/validation/pages-recovery-request.json').read_text())
target=request['stale_deployment']
if not re.fullmatch(r'[0-9a-f]{40}',target):raise ValueError('Expected explicit stale build SHA')
repo=os.environ['REPOSITORY']
if not re.fullmatch(r'[\w.-]+/[\w.-]+',repo):raise ValueError('Invalid repository')
base='https://api.github.com/repos/'+repo+'/pages'
def call(path,method='GET'):
    req=urllib.request.Request(base+path,method=method,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        return exc.code,{}

code,_=call('/deployments/'+target+'/cancel','POST')
print('Explicit stale Pages deployment cancellation HTTP',code)
if code not in (204,404):
    print('::error::Cannot cancel stale Pages deployment; HTTP '+str(code))
    raise SystemExit(1)
# Cancellation may settle asynchronously. Inspect only the safe status field.
for _ in range(10):
    status,data=call('/deployments/'+target)
    state=data.get('status','unknown');print('Stale deployment status:',status,state)
    if status==404 or state in ('deployment_cancelled','deployment_failed','succeed','cancelled','failure','success'):break
    time.sleep(2)
code,_=call('/builds','POST')
print('Pages rebuild request HTTP',code)
if code not in (201,202):
    print('::error::Pages rebuild request failed; HTTP '+str(code))
    raise SystemExit(1)
print('::notice::Stale deployment cancellation accepted and latest Pages rebuild requested; no SDK calls.')
