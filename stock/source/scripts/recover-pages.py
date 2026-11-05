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
def call(path,method='GET',body=None):
    req=urllib.request.Request(base+path,method=method,data=json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Content-Type':'application/json','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        return exc.code,{}

# The error displays a build SHA; the cancel API may require the separate deployment ID.
# Read only this explicit old job's log, extract its matching ID, never print raw logs.
job=request.get('stale_job_id')
if job:
    if not isinstance(job,int) or job<1:raise ValueError('Invalid explicit old job ID')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl):return None
    req=urllib.request.Request('https://api.github.com/repos/'+repo+'/actions/jobs/'+str(job)+'/logs',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(req,timeout=25) as response:raw=response.read(5*1024*1024)
    except urllib.error.HTTPError as exc:
        if exc.code not in (301,302,303,307,308):
            print('::error::Cannot inspect old deployment job; HTTP '+str(exc.code));raise SystemExit(1)
        location=exc.headers.get('Location','')
        if not location.startswith('https://'):raise ValueError('Unsafe log redirect')
        # Signed log URL is followed without the GitHub authorization header and never logged.
        with urllib.request.urlopen(location,timeout=25) as response:raw=response.read(5*1024*1024)
    match=re.search(r'Created deployment for '+re.escape(target)+r', ID:\s*([A-Za-z0-9_-]+)',raw.decode('utf-8',errors='replace'))
    if match:
        target=match[1]
        print('::notice::Resolved actual stale deployment ID: '+target)
    else:
        print('::warning::Old job did not expose a separate deployment ID; checking the explicit build SHA.')
code,_=call('/deployments/'+target+'/cancel','POST')
print('::notice::Explicit stale Pages cancellation HTTP '+str(code))
if code not in (204,404):
    print('::error::Cannot cancel stale Pages deployment; HTTP '+str(code));raise SystemExit(1)
cleared=False
for _ in range(15):
    status,data=call('/deployments/'+target)
    state=data.get('status','unknown')
    print('::notice::Stale deployment status HTTP '+str(status)+'; state '+str(state))
    if status==404 or state in ('deployment_cancelled','deployment_failed','succeed','cancelled','failure','success'):
        cleared=True;break
    time.sleep(2)
if not cleared:
    print('::error::GitHub still reports the old deployment active after cancellation. Rebuild withheld.');raise SystemExit(1)
if request.get('reapply_existing_source'):
    code,config=call('')
    source=config.get('source');kind=config.get('build_type')
    print('::notice::Current Pages configuration HTTP '+str(code)+'; build_type '+str(kind))
    if code!=200 or not isinstance(source,dict) or source.get('branch')!='main' or source.get('path') not in ('/','/docs'):
        print('::error::Refusing to guess or change the existing Pages source.');raise SystemExit(1)
    body={'source':source}
    if kind:body['build_type']=kind
    code,_=call('','PUT',body)
    print('::notice::Reapply identical Pages source HTTP '+str(code))
    if code not in (200,201,202,204):
        print('::error::GitHub denied the same-source Pages configuration refresh; HTTP '+str(code));raise SystemExit(1)
code,_=call('/builds','POST')
print('::notice::Pages rebuild request HTTP '+str(code))
if code not in (201,202):
    print('::error::Pages rebuild request failed; HTTP '+str(code));raise SystemExit(1)
print('::notice::Latest Pages rebuild requested; no SDK calls.')
