import datetime as dt
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from pool_data import build_pool, normalize_page, fetch_pool, PoolError, SH


def row(code='000001',roe=12,**extra):
    return dict(SECURITY_CODE=code,SECUCODE=code+'.SZ',SECURITY_NAME_ABBR='测试'+code,SECURITY_TYPE_CODE='058001001',REPORTDATE='2025-12-31',NOTICE_DATE='2026-04-20',WEIGHTAVG_ROE=roe,**extra)


class PoolTests(unittest.TestCase):
    def test_threshold_and_unknown_are_separate(self):
        rows=[row('000001',10),row('000002',10.0001),row('000003',None),row('000004',False)]
        p=build_pool([dict(count=4,pages=1,rows=rows)])
        self.assertEqual([s['code'] for s in p['stocks']],['000002'])
        self.assertEqual(p['stats']['missing_roe'],2)
        self.assertEqual(p['stats']['not_above_threshold'],1)

    def test_missing_page_or_repeated_code_aborts(self):
        with self.assertRaises(PoolError):build_pool([dict(count=501,pages=2,rows=[row()])])
        with self.assertRaises(PoolError):build_pool([dict(count=2,pages=1,rows=[row(),row()])])
        with self.assertRaises(PoolError):normalize_page({'success':True,'result':{'count':1000,'pages':1,'data':[]}})

    def test_wrong_period_and_non_a_type_abort(self):
        r=row();r['REPORTDATE']='2026-06-30'
        with self.assertRaises(PoolError):build_pool([dict(count=1,pages=1,rows=[r])])
        r=row();r['SECURITY_TYPE_CODE']='B'
        with self.assertRaises(PoolError):build_pool([dict(count=1,pages=1,rows=[r])])

    def test_failed_fetch_never_returns_a_partial_pool(self):
        with patch('pool_data.urllib.request.urlopen',side_effect=OSError('TEST outage')):
            with self.assertRaisesRegex(PoolError,'原股票池未替换'):fetch_pool()

    def test_snapshot_statistics_are_consistent(self):
        p=json.loads(Path(__file__).with_name('pool-2025.json').read_text())
        self.assertEqual(p['stats']['qualified'],len(p['stocks']))
        self.assertEqual(p['stats']['covered_a_shares'],p['stats']['qualified']+p['stats']['missing_roe']+p['stats']['not_above_threshold'])
        self.assertTrue(all(s['roe']>10 and s['report_date']=='2025-12-31' for s in p['stocks']))
