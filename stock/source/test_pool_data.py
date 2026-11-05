import datetime as dt
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from pool_data import build_pool, normalize_page, fetch_pool, PoolError, SH, backfill_annual_roe


def row(code='000001',roe=12,**extra):
    return dict(SECURITY_CODE=code,SECUCODE=code+'.SZ',SECURITY_NAME_ABBR='测试'+code,SECURITY_TYPE_CODE='058001001',REPORTDATE='2025-12-31',NOTICE_DATE='2026-04-20',WEIGHTAVG_ROE=roe,**extra)


class PoolTests(unittest.TestCase):
    def test_threshold_and_unknown_are_separate(self):
        rows=[row('000001',10),row('000002',10.0001),row('000003',None),row('000004',False)]
        p=build_pool([dict(count=4,pages=1,rows=rows)])
        self.assertEqual([s['code'] for s in p['stocks']],['000002'])
        self.assertEqual(p['stats']['missing_roe'],2)
        self.assertEqual([s['code'] for s in p['missing_roe_stocks']],['000003','000004'])
        self.assertTrue(all(s['report_date']=='2025-12-31' for s in p['missing_roe_stocks']))
        self.assertEqual(p['stats']['not_above_threshold'],1)

    def test_weighted_annual_backfill_requires_matching_control_and_never_invents_null_values(self):
        control=row('600519',32.53);control['SECUCODE']='600519.SH'
        pages=[dict(count=4,pages=1,rows=[control,row('000002',None),row('000003',None),row('000004',None)])]
        result=build_pool(pages)
        with patch('pool_data.read_annual_main_index',side_effect=[{'ROEJQ':32.53},{'ROEJQ':12.5},{'ROEJQ':None,'BPS':-2},{'ROEJQ':10}]),patch('pool_data.time.sleep'):
            audit=backfill_annual_roe(pages,result)
        refreshed=build_pool(pages)
        self.assertEqual(audit['filled'],2);self.assertEqual(refreshed['stats']['missing_roe'],1)
        self.assertEqual([s['code'] for s in refreshed['stocks']],['600519','000002'])
        self.assertEqual(audit['records'][1]['year_end_bps'],-2)
        other=[dict(count=2,pages=1,rows=[control,row('000009',None)])]
        with patch('pool_data.read_annual_main_index',return_value={'ROEJQ':99}):audit=backfill_annual_roe(other,build_pool(other))
        self.assertEqual(audit['control']['status'],'unavailable');self.assertEqual(build_pool(other)['stats']['missing_roe'],1)

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
