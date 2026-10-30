import datetime as dt
import tempfile
import unittest
from pathlib import Path
from cloud_cache import load_cached, expected, SH

class CloudCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=self.temp.name;self.now=dt.datetime(2026,10,30,14,5,tzinfo=SH);self.calls=0
    def load(self,kind='hourly',now=None):
        now=now or self.now
        def fetch():
            self.calls+=1
            return {'code':'600809','adjustment':'none','bars':[{'endTime':expected(now,'hourly'),'date':expected(now,'history')}],'reports':[{'period':'2025'}]}
        return load_cached(self.root,kind,'600809',fetch,now)
    def test_hit_and_next_hour_expiry(self):
        self.assertFalse(self.load()['cloud_cache_hit']);self.assertTrue(self.load()['cloud_cache_hit']);self.assertEqual(self.calls,1)
        self.assertFalse(self.load(now=self.now.replace(hour=15))['cloud_cache_hit']);self.assertEqual(self.calls,2)
    def test_daily_close_and_financial_ttl(self):
        self.load('history');self.assertTrue(self.load('history')['cloud_cache_hit'])
        self.assertFalse(self.load('history',self.now.replace(hour=16))['cloud_cache_hit'])
        self.load('financial');self.assertTrue(self.load('financial')['cloud_cache_hit'])
        self.assertFalse(self.load('financial',self.now+dt.timedelta(hours=1))['cloud_cache_hit'])
    def test_corrupt_and_future_cache_refetched(self):
        self.load();p=Path(self.root)/'hourly-600809.json';p.write_text('{}')
        self.assertFalse(self.load()['cloud_cache_hit'])
        self.assertFalse(self.load(now=self.now-dt.timedelta(minutes=1))['cloud_cache_hit'])
    def test_errors_not_cached_and_unwritable_cache_nonfatal(self):
        def fail():raise RuntimeError('source down')
        with self.assertRaises(RuntimeError):load_cached(self.root,'hourly','600809',fail,self.now)
        self.assertFalse(list(Path(self.root).glob('*.json')))
        p=Path(self.root)/'file';p.write_text('blocked');self.root=str(p)
        self.assertFalse(self.load()['cloud_cache_hit'])
    def test_quotes_always_fetched(self):
        self.load('quote');self.load('quote');self.assertEqual(self.calls,2)
        self.assertFalse(list(Path(self.root).glob('*.json')))

if __name__=='__main__':unittest.main()
