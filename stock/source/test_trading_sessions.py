"""Exchange holiday checks; synthetic timestamps, no market-data fees."""
import datetime as dt
import unittest
from trading_sessions import is_trading_day
from cloud_cache import expected,SH

class TradingSessionTests(unittest.TestCase):
    def test_weekends_and_exchange_holidays_skip_collection(self):
        for date in ['2026-01-01','2026-01-02','2026-02-16','2026-02-23','2026-04-06','2026-05-01','2026-05-05','2026-09-25','2026-10-01','2026-10-07','2026-10-10','2026-11-07']:
            self.assertFalse(is_trading_day(date),date)
        self.assertTrue(is_trading_day('2026-11-06'))
    def test_closed_exchange_day_keeps_last_completed_session(self):
        self.assertEqual(expected(dt.datetime(2026,10,5,15,5,tzinfo=SH),'history'),'2026-09-30')
        self.assertEqual(expected(dt.datetime(2026,10,8,9,0,tzinfo=SH),'hourly'),'2026-09-30T15:00:00+08:00')
        self.assertEqual(expected(dt.datetime(2026,10,8,10,35,tzinfo=SH),'hourly'),'2026-10-08T10:30:00+08:00')

if __name__=='__main__':unittest.main()
