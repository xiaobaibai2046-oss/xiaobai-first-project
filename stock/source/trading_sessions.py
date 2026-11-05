"""A-share exchange sessions; no billable market-data request is used for scheduling."""
import datetime as dt
import json
from pathlib import Path
from functools import lru_cache

@lru_cache(maxsize=1)
def calendar():return json.loads(Path(__file__).with_name('trading-calendar.json').read_text())

def is_trading_day(day):
    text=day.isoformat() if isinstance(day,dt.date) else str(day)
    data=calendar()
    if data['start']<=text<=data['end']:return text in data['sessions']
    # Historical strategy inputs retain the old weekday fallback. The workflow gate
    # separately refuses unverified future dates until the calendar is refreshed.
    return dt.date.fromisoformat(text).weekday()<5
