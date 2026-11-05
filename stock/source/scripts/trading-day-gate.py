"""Scheduled-run holiday gate. Fail closed beyond verified exchange-calendar coverage."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sys
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from trading_sessions import calendar,is_trading_day

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');args=parser.parse_args()
    today=dt.datetime.now(ZoneInfo('Asia/Shanghai')).date();data=calendar();covered=data['start']<=today.isoformat()<=data['end']
    if args.refresh and not covered:
        import exchange_calendars as xc
        import importlib.metadata
        # The library raises rather than inventing holidays beyond its known calendar.
        exchange=xc.get_calendar('XSHG',start=f'{today.year-1}-01-01',end=f'{today.year}-12-31')
        if exchange.last_session.year<today.year:raise RuntimeError('Exchange calendar does not yet cover this year')
        value=exchange.is_session(today.isoformat());source='exchange_calendars '+importlib.metadata.version('exchange-calendars')
        updated={'schema_version':1,'market':'XSHG','source':source+' XSHG precomputed exchange sessions','start':f'{today.year-1}-01-01','end':f'{today.year}-12-31','sessions':[x.strftime('%Y-%m-%d') for x in exchange.sessions]}
        root=Path(__file__).resolve().parent.parent
        root.joinpath('trading-calendar.json').write_text(json.dumps(updated,ensure_ascii=False,separators=(',',':'))+'\n')
        javascript="// Generated from trading-calendar.json.\nconst calendar="+json.dumps(updated,separators=(',',':'))+";\nconst sessions=new Set(calendar.sessions);\nexport function isTradingDay(date){if(date>=calendar.start&&date<=calendar.end)return sessions.has(date);return ![0,6].includes(new Date(date+'T00:00:00Z').getUTCDay())}\n"
        root.joinpath('trading-calendar.js').write_text(javascript)

    elif covered:value=is_trading_day(today);source=data['source']
    else:value=False;source='calendar_update_required'
    output={'covered':str(covered).lower(),'is_session':str(bool(value)).lower(),'calendar_updated':str(args.refresh and not covered).lower()}
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:
            for k,v in output.items():f.write(k+'='+v+'\n')
    print(json.dumps({'date':today.isoformat(),'source':source,**output},ensure_ascii=False))
