"""Contract tests use explicitly synthetic provider-shaped payloads, not live data."""
import datetime as dt
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch
import server


def quote_text(code='600519'):
    fields = [''] * 50
    for i,v in {1:'测试公司（合成）',2:code,3:'100',4:'98',5:'99',6:'1000',30:'20250102150000',33:'101',34:'97',37:'1000',39:'20',46:'3'}.items():
        fields[i]=v
    return 'v_'+server.symbol(code)+'="'+'~'.join(fields)+'";'


class AdapterTests(unittest.TestCase):
    def setUp(self):
        server.CACHE.clear()

    def test_symbol_validation(self):
        self.assertEqual(server.symbol('600519'),'sh600519')
        self.assertEqual(server.symbol('000001'),'sz000001')
        self.assertEqual(server.symbol('920001'),'bj920001')
        for code in ('../../secret','600519&url=evil','123456','00001'):
            with self.assertRaises(server.DataError): server.symbol(code)

    def test_quote_time_units_and_missing_quote(self):
        q=server.parse_quote(quote_text(),'600519')
        self.assertEqual(q['price'],100)
        self.assertAlmostEqual(q['change_pct'],(100/98-1)*100)
        self.assertTrue(q['stale'])
        self.assertEqual(q['volume_lots'],1000)
        self.assertTrue(q['exchange_time'].endswith('+08:00'))
        with self.assertRaises(server.DataError):server.parse_quote('v_sh600519="";','600519')
        with patch.object(server,'fetch',return_value=quote_text()):
            first=server.get_quotes(['600519']);second=server.get_quotes(['600519'])
            self.assertFalse(first['cache_hit']);self.assertTrue(second['cache_hit'])
            self.assertEqual(first['fetched_at'],second['fetched_at'])

    def test_history_unadjusted_contract_and_remove_unfinished_bar(self):
        today=dt.datetime.now(server.SH).date().isoformat()
        payload={'code':0,'data':{'sh600519':{'day':[['2025-01-02','99','100','101','98','1000'],[today,'100','101','102','99','1500']],'qt':{'sh600519':['','测试公司（合成）']}}}}
        out=server.parse_history(payload,'600519')
        self.assertEqual(out['bars'][0]['open'],99)
        self.assertEqual(out['bars'][0]['close'],100)
        self.assertEqual(out['adjustment'],'none')
        if dt.datetime.now(server.SH).hour<16:self.assertEqual(out['last_date'],'2025-01-02')
        with self.assertRaises(server.DataError):server.parse_history({'data':{'sh600519':{'qfqday':payload['data']['sh600519']['day']}}},'600519')
        payload['data']['sh600519']['day'][0][3]='1'
        with self.assertRaises(server.DataError):server.parse_history(payload,'600519')

    def test_financial_period_notice_missing_and_zero_not_confused(self):
        payload={'success':True,'result':{'data':[{'SECURITY_CODE':'600519','SECURITY_NAME_ABBR':'合成公司','REPORTDATE':'2025-03-31 00:00:00','NOTICE_DATE':'2025-04-20 00:00:00','BASIC_EPS':0,'TOTAL_OPERATE_INCOME':100,'PARENT_NETPROFIT':0,'YSTZ':-10,'SJLTZ':None,'WEIGHTAVG_ROE':0,'MGJYXJJE':'--'},{'SECURITY_CODE':'600519','REPORTDATE':'2099-01-01'}]}}
        out=server.parse_financial(payload,'600519');self.assertEqual(len(out['reports']),1)
        r=out['reports'][0];self.assertEqual(r['eps'],0);self.assertEqual(r['roe'],0);self.assertEqual(r['revenue_yoy'],-10);self.assertIsNone(r['profit_yoy']);self.assertIsNone(r['ocf_per_share'])
        self.assertEqual(r['notice_date'],'2025-04-20')
        payload['result']['data'][0]['SECURITY_CODE']='000001'
        with self.assertRaises(server.DataError):server.parse_financial(payload,'600519')

    def test_denied_network_never_becomes_synthetic_success(self):
        with patch.object(server.urllib.request,'urlopen',side_effect=urllib.error.URLError('Tunnel connection failed: 403 Forbidden')):
            with self.assertRaisesRegex(server.DataError,'403'):server.get_quotes(['600519'])
        self.assertEqual(server.CACHE,{})


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.http.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.thread.join()

    def test_health_and_static(self):
        with urllib.request.urlopen(self.base+'/api/health') as response:
            self.assertEqual(json.load(response)['status'],'ok')
        with urllib.request.urlopen(self.base+'/') as response:
            self.assertIn('知衡'.encode(),response.read())

    def test_api_failure_is_structured_and_not_demo(self):
        with patch.object(server,'get_quotes',side_effect=server.DataError('TEST network denied')):
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(self.base+'/api/quotes?codes=600519')
            self.assertEqual(error.exception.code,502)
            body=json.load(error.exception);self.assertEqual(body['error'],'TEST network denied');self.assertFalse(body['simulated'])

    def test_success_route_passes_normalized_data(self):
        with patch.object(server,'get_quotes',return_value={'quotes':[{'code':'600519','price':100}],'errors':[]}) as adapter:
            with urllib.request.urlopen(self.base+'/api/quotes?codes=600519,600519') as response:
                data=json.load(response)
            self.assertEqual(data['quotes'][0]['price'],100);adapter.assert_called_once_with(['600519'])

    def test_bad_codes_are_400_without_upstream_access(self):
        with patch.object(server,'fetch') as upstream:
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(self.base+'/api/quotes?codes=123456')
            self.assertEqual(error.exception.code,400)
            upstream.assert_not_called()
