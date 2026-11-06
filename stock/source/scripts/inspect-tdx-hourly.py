"""Two official raw hourly calls; publish only safe timestamps and OHLCV tail fields."""
import datetime as dt
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent.parent;sys.path.insert(0,str(ROOT))
from tdx_provider import Provider,TdxError,symbol,normalize_bars
p=Provider(max_calls=4);report={'at':dt.datetime.now(dt.timezone.utc).isoformat(),'results':{}}
try:
    for code in ['600519','000001']:
        try:
            raw=p.raw('bars',code,period='1h',count=120,adjustment='none');out={}
            for field in ['Open','High','Low','Close','Volume','Amount']:
                frame=raw.get(field,{}) if isinstance(raw,dict) else {};out[field]={'index_tail':frame.get('index',[])[-5:],'value_tail':frame.get('columns',{}).get(symbol(code),[])[-5:]}
            try:data=normalize_bars(raw,code,'1h');out['normalized']={'status':'success','last_time':data['last_time']}
            except TdxError as e:out['normalized']={'status':e.category}
            report['results'][code]=out
        except TdxError as e:report['results'][code]={'status':e.category}
    report['sdk_calls']=p.calls
    (ROOT/'validation/tdx-intraday.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
finally:p.close()
