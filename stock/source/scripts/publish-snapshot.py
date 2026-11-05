"""Publish only generated stock artifacts; surface sanitized Git failures as annotations."""
import re
import subprocess
import sys
import time

def run(*args):
    for attempt in range(3):
        p=subprocess.run(args,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        if p.returncode and "fatal error in commit_refs_rules" in p.stdout and attempt<2:
            time.sleep(2+attempt*3);continue
        break
    if p.returncode:
        # No credentials are printed: strip URL userinfo and recognized token patterns.
        error=re.sub(r'https://[^/\s@]+@','https://[REDACTED]@',p.stdout)
        error=re.sub(r'(?:TDX-[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)','[REDACTED]',error)
        print('::error::'+('Git '+args[1]+' failed: '+error).replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
        sys.exit(p.returncode)
    return p.stdout

run('git','config','user.name','github-actions[bot]')
run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
run('git','add','stock/source/pool-signals.json','stock/pool-signals.json','stock/index.html','stock/formulas')
p=subprocess.run(['git','diff','--cached','--quiet'])
if p.returncode:
    run('git','commit','-m','Refresh background stock signal snapshot')
    run('git','pull','--rebase','origin','main')
    run('git','push','origin','HEAD:main')
