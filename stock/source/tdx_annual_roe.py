"""Strict annual weighted ROE extraction for the official FN281 by-date endpoint."""
import math
from tdx_provider import symbol,TdxError

def extract_annual_roe(raw,code):
    obj=raw.get('Value',raw) if isinstance(raw,dict) else {}
    entry=obj.get(symbol(code)) if isinstance(obj,dict) else None
    if not isinstance(entry,dict) or 'FN281' not in entry:raise TdxError('schema')
    value=entry['FN281']
    for _ in range(4):
        if isinstance(value,list):
            if len(value)!=1:raise TdxError('schema')
            value=value[0]
        elif isinstance(value,dict):
            date=value.get('Date')
            if date and str(date).replace('-','')[:8]!='20251231':raise TdxError('schema')
            value=value.get('Value')
        else:break
    if value is None or isinstance(value,bool) or str(value).strip() in ('','--','-','None'):raise TdxError('unavailable')
    try:roe=float(value)
    except (TypeError,ValueError):raise TdxError('schema')
    if not math.isfinite(roe) or abs(roe)>=1e30:raise TdxError('unavailable')
    return roe
