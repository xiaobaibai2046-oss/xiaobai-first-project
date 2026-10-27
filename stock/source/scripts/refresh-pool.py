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
    result = fetch_pool(lambda page,total,count: print(f'年报分页 {page}/{total}；来源共 {count} 条', flush=True))
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=ROOT, suffix='.tmp', delete=False) as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
        temporary = f.name
    os.replace(temporary, ROOT/'pool-2025.json')
    print(json.dumps(dict(as_of=result['as_of'], **result['stats']), ensure_ascii=False), flush=True)
