"""Rebuild the verified pool snapshot; replace only after complete validation."""
import json
import os
from pathlib import Path
import sys
import tempfile
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pool_data import fetch_pool

if __name__ == '__main__':
    before = json.loads((ROOT/'pool-2025.json').read_text())
    result = fetch_pool(lambda page,total,count: print(f'年报分页 {page}/{total}；来源共 {count} 条', flush=True))
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=ROOT, suffix='.tmp', delete=False) as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
        temporary = f.name
    os.replace(temporary, ROOT/'pool-2025.json')
    print(json.dumps(dict(as_of=result['as_of'], **result['stats']), ensure_ascii=False), flush=True)

    old={s['code']:s for s in before['stocks']};new={s['code']:s for s in result['stocks']}
    report={'updated_at':result['as_of'],'year':2025,'metric':result['roe_metric'],'source':result['source'],'before':before['stats'],'after':result['stats'],'added':[new[c] for c in sorted(new.keys()-old.keys())],'removed':[old[c] for c in sorted(old.keys()-new.keys())],'missing_roe_stocks':result.get('missing_roe_stocks',[]),'membership_changed':old.keys()!=new.keys(),'note':'Only verified 2025 annual weighted ROE > 10% enters the pool. Missing is not treated as failure or replaced with quarterly/diluted ROE.'}
    (ROOT/'validation/annual-pool-refresh.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
