"""Explicit synthetic SDK contracts; these tests are NOT evidence of live TDX access."""
import datetime as dt
import io
import json
import os
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch,Mock
from tdx_provider import Provider,TdxError,normalize_bars,normalize_snapshot,classify_error,SH,SOURCE
from tdx_sdk_worker import redact,has_data
from market_metrics import metrics
import server
from tdx_annual_roe import extract_annual_roe,reuse_verified_backfill


def frames(code='600519',period='1d'):
    index=['2026-11-02 00:00:00','2026-11-03 00:00:00'] if period=='1d' else ['2026-11-03 10:30:00','2026-11-03 11:30:00']
    return {k:{'index':index,'columns':{code+'.SH':v}} for k,v in {'Open':[10,11],'High':[12,13],'Low':[9,10],'Close':[11,12],'Volume':[1000,2000],'Amount':[5,6]}.items()}

class TdxTests(unittest.TestCase):
    def test_official_annual_weighted_roe_parser_preserves_period_and_missing(self):
        self.assertEqual(extract_annual_roe({'600519.SH':{'FN281':'32.53'}},'600519'),32.53)
        self.assertEqual(extract_annual_roe({'Value':{'600519.SH':{'FN281':[{'Date':'20251231','Value':['-12.5']}]}}},'600519'),-12.5)
        for value in [None,True,'nan',1e38,{'Date':'20260930','Value':[12]}]:
            with self.assertRaises(TdxError):extract_annual_roe({'600519.SH':{'FN281':value}},'600519')
        with self.assertRaises(TdxError):extract_annual_roe({'000001.SZ':{'FN281':12}},'600519')

    def test_public_refresh_keeps_only_verified_same_year_official_backfill(self):
        pool={'stocks':[],'missing_roe_stocks':[{'code':'000001','name':'TEST','exchange':'SZ','report_date':'2025-12-31'}],'stats':{'covered_a_shares':1,'missing_roe':1,'qualified':0,'not_above_threshold':0}}
        report={'field':'FN281','source':'通达信官方 TdxAiData','report_date':'2025-12-31','controls':{'SZ':{'status':'matched'}},'results':[{'code':'000001','status':'verified','roe':12}]}
        report['report_date']='2026-09-30';self.assertEqual(reuse_verified_backfill(pool,report),0)
        report['report_date']='2025-12-31';self.assertEqual(reuse_verified_backfill(pool,report),1);self.assertEqual(pool['stocks'][0]['roe'],12);self.assertEqual(pool['stats']['missing_roe'],0)

    def test_official_units_and_schema_match_existing_model(self):
        d=normalize_bars(frames(),'600519','1d',dt.datetime(2026,11,3,16,tzinfo=SH))
        self.assertEqual(d['bars'][0]['close'],11);self.assertEqual(d['bars'][0]['volume'],10)
        self.assertEqual(d['bars'][0]['volume_shares'],1000);self.assertEqual(d['bars'][0]['amount_cny'],50000)
        self.assertEqual(d['adjustment'],'none');self.assertEqual(d['source'],SOURCE)
    def test_front_adjustment_is_sent_to_sdk_and_separates_cache(self):
        p=Provider();p.raw=Mock(return_value=frames())
        p.get('history','600519',adjustment='front')
        self.assertEqual(p.raw.call_args.kwargs['adjustment'],'front')
        self.assertEqual(p.get('history','600519',adjustment='front')['adjustment'],'front')
        self.assertEqual(p.raw.call_count,1)
        p.get('history','600519',adjustment='none');self.assertEqual(p.raw.call_count,2)
        provider=Mock();provider.configured.return_value=True;provider.get.side_effect=TdxError('permission')
        with patch.dict(os.environ,{'TDX_ADJUSTMENT':'front'}),patch('tdx_provider.default_provider',return_value=provider),patch.object(server,'public_get_history') as fallback:
            with self.assertRaises(RuntimeError):server.get_history('600519')
            fallback.assert_not_called()
    def test_forming_daily_and_hourly_never_enter_closed_strategy(self):
        d=normalize_bars(frames(),'600519','1d',dt.datetime(2026,11,3,10,tzinfo=SH))
        self.assertEqual(len(d['bars']),1);self.assertEqual(d['forming_bar']['date'],'2026-11-03')
        h=normalize_bars(frames(period='1h'),'600519','1h',dt.datetime(2026,11,3,11,tzinfo=SH))
        self.assertEqual(len(h['bars']),1);self.assertIn('10:30',h['last_time'])
    def test_vendor_future_intraday_label_does_not_discard_real_closed_hour(self):
        raw=frames(period='1h')
        for frame in raw.values():frame['index']=['2026-11-03 10:30:00','2026-11-03 13:00:00']
        value=normalize_bars(raw,'600519','1h',dt.datetime(2026,11,3,10,51,tzinfo=SH))
        self.assertEqual(len(value['bars']),1);self.assertEqual(value['bars'][0]['endTime'],'2026-11-03T10:30:00+08:00')
        self.assertEqual(value['forming_bar']['endTime'],'2026-11-03T13:00:00+08:00')
        # The vendor label is not remapped; if it is already past, it must still fail strict closed-bar validation.
        with self.assertRaises(TdxError):normalize_bars(raw,'600519','1h',dt.datetime(2026,11,3,14,5,tzinfo=SH))

    def test_unverified_columns_or_prices_fail_closed(self):
        for modify in [lambda d:d['Close']['columns']['600519.SH'].pop(),lambda d:d['High']['columns']['600519.SH'].__setitem__(0,1),lambda d:d['Low'].__setitem__('index',[])]:
            d=frames();modify(d)
            with self.assertRaises(TdxError):normalize_bars(d,'600519','1d')
    def test_snapshot_never_fabricates_timestamp_amount_scale_or_permission(self):
        d=normalize_snapshot({'Now':'12','LastClose':'10','Volume':'50','Amount':'123'},'600519')
        q=d['quotes'][0];self.assertAlmostEqual(q['change_pct'],20)
        self.assertIsNone(q['exchange_time']);self.assertIsNone(q['amount_10k_cny']);self.assertEqual(q['volume_lots'],50)
        self.assertEqual(d['depth']['status'],'field_unavailable')
    def test_nested_empty_sdk_tables_are_not_successful_live_data(self):
        self.assertFalse(has_data({'600519.SH':{'Date':[],'GP07':[]}}))
        self.assertFalse(has_data({'columns':{'Price':[]},'index':[]}))
        self.assertTrue(has_data({'Volume':[0]}))

    def test_error_categories_and_secret_redaction(self):
        for message,kind in [('积分余额不足','credits'),('接口权限不足','permission'),('token invalid','authentication'),('connection timed out','network'),('频率超限流','rate_limit'),('empty','unavailable')]:
            error=classify_error(message+' TDX-TEST_SECRET');self.assertEqual(error['category'],kind);self.assertNotIn('TEST_SECRET',str(error))
        self.assertEqual(redact({'token':'sensitive','result':'TDX-abcdef'}),{'result':'[REDACTED]'})
    def test_network_policy_blocks_before_native_calls(self):
        p=Provider()
        with patch.dict(os.environ,{'TDX_DATA_KEY':'TEST_NOT_A_REAL_KEY'}),patch('tdx_provider.check_network_policy',side_effect=TdxError('network_policy')),patch('tdx_provider.subprocess.Popen') as spawn:
            with self.assertRaises(TdxError) as e:p.get('quote','600519')
            self.assertEqual(e.exception.category,'network_policy');spawn.assert_not_called();self.assertEqual(p.calls,0)
    def test_budget_and_entitlement_circuit_keep_original_reason(self):
        p=Provider(max_calls=0)
        with patch.dict(os.environ,{'TDX_DATA_KEY':'TEST_NOT_A_REAL_KEY'}),patch('tdx_provider.check_network_policy'),patch('tdx_provider.subprocess.Popen') as spawn:
            with self.assertRaises(TdxError) as e:p.raw('snapshot','600519')
            self.assertEqual(e.exception.category,'budget');spawn.assert_not_called()
            p.max_calls=10;p.circuit['global']=(time.monotonic()+300,'credits')
            with self.assertRaises(TdxError) as e:p.raw('snapshot','600519')
            self.assertEqual(e.exception.category,'credits');spawn.assert_not_called()
    def test_one_market_permission_failure_does_not_disable_other_markets(self):
        p=Provider(min_interval=0);proc=Mock();proc.poll.return_value=None;proc.stdin=io.StringIO();p.process=proc
        proc.stdout=io.StringIO(json.dumps({'ok':False,'error':{'category':'permission'}})+'\n')
        with patch.dict(os.environ,{'TDX_DATA_KEY':'TEST_NOT_A_REAL_KEY'}),patch('tdx_provider.check_network_policy'),patch('tdx_provider.selectors.DefaultSelector') as factory:
            factory.return_value.__enter__.return_value.select.return_value=[True]
            with self.assertRaises(TdxError):p.raw('snapshot','920001')
            proc.stdout=io.StringIO(json.dumps({'ok':True,'data':{'Now':'12'}})+'\n')
            self.assertEqual(p.raw('snapshot','600519')['Now'],'12')
            with self.assertRaises(TdxError) as e:p.raw('snapshot','920002')
            self.assertEqual(e.exception.category,'permission');self.assertEqual(p.calls,2)

    def test_empty_symbol_does_not_disable_other_stocks(self):
        p=Provider(min_interval=0);proc=Mock();proc.poll.return_value=None;proc.stdin=io.StringIO();p.process=proc
        proc.stdout=io.StringIO(json.dumps({'ok':False,'error':{'category':'unavailable'}})+'\n')
        with patch.dict(os.environ,{'TDX_DATA_KEY':'TEST_NOT_A_REAL_KEY'}),patch('tdx_provider.check_network_policy'),patch('tdx_provider.selectors.DefaultSelector') as factory:
            factory.return_value.__enter__.return_value.select.return_value=[True]
            with self.assertRaises(TdxError):p.raw('snapshot','600001')
            proc.stdout=io.StringIO(json.dumps({'ok':True,'data':{'Now':'12'}})+'\n')
            self.assertEqual(p.raw('snapshot','600519')['Now'],'12');self.assertEqual(p.calls,2)

    def test_quote_depth_cache_and_parallel_request_coalescing(self):
        p=Provider();p.raw=Mock(return_value={'Now':'12','LastClose':'10'})
        with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(lambda _:p.get('quote','600519'),range(8)))
        p.get('depth','600519');self.assertEqual(p.raw.call_count,1)
    def test_official_failure_keeps_backup_source_and_failure_category(self):
        provider=Mock();provider.configured.return_value=True;provider.get.side_effect=TdxError('permission')
        with patch('tdx_provider.default_provider',return_value=provider),patch.object(server,'public_get_history',return_value={'source':'TEST explicit backup','bars':[]}):
            d=server.get_history('600519',80);self.assertEqual(d['provider'],'tencent_backup');self.assertEqual(d['source'],'TEST explicit backup');self.assertEqual(d['primary_status']['category'],'permission')
    def test_derived_indicators_use_real_normalized_numbers(self):
        bars=[{'close':i} for i in range(1,31)];m=metrics(bars)
        self.assertEqual(m['MA5'],28);self.assertEqual(m['MA20'],20.5);self.assertEqual(m['MA10'],25.5);self.assertEqual(m['RSI14'],100)
        self.assertEqual(metrics([{'close':1}]*30)['MACD']['DIF'],0)

if __name__=='__main__':unittest.main()
