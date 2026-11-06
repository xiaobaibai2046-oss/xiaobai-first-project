"""Reconstruct today's closed cash-session hours from official 5-minute bars.
Historical native hours remain strictly validated; no vendor timestamps are relabelled.
"""
import datetime as dt
from tdx_provider import normalize_bars,symbol,TdxError,SH,SOURCE
ENDS=('10:30','11:30','14:00','15:00')
FIELDS=('Open','High','Low','Close','Volume','Amount')

def has_noncanonical_today(raw,now):
    try:
        for value in raw['Close']['index']:
            t=dt.datetime.fromisoformat(value)
            t=t.replace(tzinfo=SH) if t.tzinfo is None else t.astimezone(SH)
            if t.date()==now.date() and t<=now and t.strftime('%H:%M') not in ENDS:return True
    except (KeyError,TypeError,ValueError):return False
    return False

def reconstruct_today(raw,minutes,code,now,count=320,adjustment='none'):
    sid=symbol(code);today=now.astimezone(SH).date();day=today.isoformat()
    try:
        index=raw['Close']['index'];keep=[i for i,v in enumerate(index) if dt.datetime.fromisoformat(v).date()<today]
        history={}
        for field in FIELDS:
            frame=raw[field]
            if frame['index']!=index or len(frame['columns'][sid])!=len(index):raise TdxError('schema')
            history[field]={'index':[index[i] for i in keep],'columns':{sid:[frame['columns'][sid][i] for i in keep]}}
        bars=normalize_bars(history,code,'1h',now,adjustment)['bars'] if keep else []
    except (KeyError,TypeError,ValueError):raise TdxError('schema')
    minute=normalize_bars(minutes,code,'5m',now,adjustment)
    lookup={b['endTime']:b for b in minute['bars'] if b['endTime'][:10]==day}
    derived=[]
    for start,end in [('09:30','10:30'),('10:30','11:30'),('13:00','14:00'),('14:00','15:00')]:
        anchor=dt.datetime.fromisoformat(day+'T'+start+':00+08:00')
        finish=dt.datetime.fromisoformat(day+'T'+end+':00+08:00')
        if finish>now:continue
        stamps=[(anchor+dt.timedelta(minutes=5*i)).isoformat(timespec='seconds') for i in range(1,13)]
        if any(t not in lookup for t in stamps):continue # Never fill gaps or infer a missing bar.
        group=[lookup[t] for t in stamps]
        derived.append({'code':code,'endTime':finish.isoformat(timespec='seconds'),'open':group[0]['open'],'high':max(b['high'] for b in group),'low':min(b['low'] for b in group),'close':group[-1]['close'],'volume':sum(b['volume'] for b in group),'volume_shares':sum(b['volume_shares'] for b in group),'amount_cny':sum(b['amount_cny'] for b in group)})
    # Cross-check any canonical native hour against independent period aggregation.
    matched=0
    for b in derived:
        key=b['endTime'][:19].replace('T',' ')
        candidates=[i for i,v in enumerate(index) if str(v)[:19].replace('T',' ')==key]
        if candidates:
            i=candidates[0]
            for field,k in [('Open','open'),('High','high'),('Low','low'),('Close','close')]:
                if abs(float(raw[field]['columns'][sid][i])-b[k])>1e-6:raise TdxError('schema')
            matched+=1
    if not derived:raise TdxError('unavailable')
    bars=(bars+derived)[-count:]
    return {'code':code,'name':code,'bars':bars,'timeframe':'1h','last_time':bars[-1]['endTime'],'adjustment':adjustment,'source':SOURCE+'（当日由官方5分钟K线合成）','provider':'tdx_official','volume_unit':'手（SDK股数÷100）','amount_unit':'元（SDK万元×10000）','composition':{'minute_count':12,'canonical_native_matches':matched,'session_ends':list(ENDS),'missing_bars_filled':False}}
