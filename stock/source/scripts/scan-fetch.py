"""Bounded JSON-line fetcher for the Node signal scanner. TLS remains verified."""
import json
import sys
import threading
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
import server
from cloud_cache import load_cached
lock=threading.Lock()
def run(job):
    try:
        code=job['code'];server.symbol(code)
        loaders={'history':lambda:server.get_history(code,80),'hourly':lambda:server.get_hourly(code),'quote':lambda:server.get_quotes([code]),'financial':lambda:server.get_financial(code)}
        # With official credentials use its own bounded cache; never reuse public bars under an official label.
        official=bool(os.environ.get('TDX_DATA_KEY') or os.environ.get('TDX_CONFIG_FILE'))
        if job['kind']=='_stats':
            from tdx_provider import default_provider
            provider=default_provider();data={'tdx_sdk_calls':provider.calls,'tdx_max_calls':provider.max_calls,'configured':provider.configured()}
        elif official and job['kind'] in ('history','hourly'):
            root=os.environ.get('CLOUD_MARKET_CACHE');root=str(Path(root)/'tdx-official-v1') if root else None
            data=load_cached(root,job['kind'],code,loaders[job['kind']],source_prefix='通达信官方 TdxAiData')
        else:data=load_cached(os.environ.get('CLOUD_MARKET_CACHE'),job['kind'],code,loaders[job['kind']])
        out={'id':job['id'],'data':data}
    except Exception as exc:out={'id':job['id'],'error':str(exc)}
    with lock:print(json.dumps(out,ensure_ascii=False),flush=True)
with ThreadPoolExecutor(max_workers=2) as pool:
    for line in sys.stdin:
        pool.submit(run,json.loads(line))
