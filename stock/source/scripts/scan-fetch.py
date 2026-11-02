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
        data=load_cached(os.environ.get('CLOUD_MARKET_CACHE'),job['kind'],code,loaders[job['kind']])
        out={'id':job['id'],'data':data}
    except Exception as exc:out={'id':job['id'],'error':str(exc)}
    with lock:print(json.dumps(out,ensure_ascii=False),flush=True)
with ThreadPoolExecutor(max_workers=2) as pool:
    for line in sys.stdin:
        pool.submit(run,json.loads(line))
