"""Same-origin A-share market adapters. Python standard library only."""
import argparse
import datetime as dt
import json
import math
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

from pool_data import fetch_pool, PoolError

ROOT = Path(__file__).resolve().parent
SH = ZoneInfo('Asia/Shanghai')
CACHE = {}
LOCK = threading.Lock()


class DataError(Exception):
    pass


class InputError(DataError):
    pass


def symbol(code):
    if not re.fullmatch(r'\d{6}', code or ''):
        raise InputError('股票代码须为六位数字')
    if code.startswith(('60', '68')):
        return 'sh' + code
    if code.startswith(('00', '30')):
        return 'sz' + code
    if code.startswith(('43', '83', '87', '92')):
        return 'bj' + code
    raise InputError('暂仅支持沪深北 A 股代码，不支持指数、基金或港股')


def number(value):
    if value in (None, '', '-', '--') or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def fetch(url, encoding='utf-8'):
    # URLs are constructed only by fixed adapters, never supplied by clients.
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'})
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            body = response.read(8_000_001)
            if len(body) > 8_000_000:
                raise DataError('数据源响应过大')
            return body.decode(encoding)
    except (urllib.error.URLError, TimeoutError, UnicodeError, OSError) as exc:
        if '403' in str(exc):
            raise DataError('上游或网络代理拒绝访问（403）；请检查环境网络允许域名') from exc
        raise DataError('数据源连接失败或响应超时，请稍后重试') from exc


def cached(key, ttl, loader):
    with LOCK:
        old = CACHE.get(key)
        if old and time.monotonic() - old[0] < ttl:
            return dict(old[1], cache_hit=True)
    value = dict(loader(), fetched_at=dt.datetime.now(SH).isoformat(timespec='seconds'))
    with LOCK:
        if len(CACHE) >= 200:
            CACHE.pop(next(iter(CACHE)))
        CACHE[key] = (time.monotonic(), value)
    return dict(value, cache_hit=False)


def decode_json(body):
    try:
        result = json.loads(body)
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (ValueError, TypeError) as exc:
        raise DataError('数据源返回了无法解析的 JSON') from exc


def parse_quote(text, code):
    key = symbol(code)
    match = re.search(r'(?:v_)?' + re.escape(key) + r'="([^"]*)"', text)
    if not match:
        raise DataError('行情源未返回该股票')
    fields = match.group(1).split('~')
    if len(fields) < 47 or fields[2] != code:
        raise DataError('行情字段不完整或股票代码不匹配')
    try:
        stamp = dt.datetime.strptime(fields[30], '%Y%m%d%H%M%S').replace(tzinfo=SH)
    except ValueError as exc:
        raise DataError('行情缺少有效的交易所时间') from exc
    price, previous = number(fields[3]), number(fields[4])
    if price is None or price <= 0:
        raise DataError('当前没有有效成交价')
    now = dt.datetime.now(SH)
    return dict(code=code, name=fields[1], price=price, previous_close=previous,
                change_pct=(price / previous - 1) * 100 if previous and previous > 0 else None,
                open=number(fields[5]), high=number(fields[33]), low=number(fields[34]),
                volume_lots=number(fields[6]), amount_10k_cny=number(fields[37]),
                pe_ttm=number(fields[39]), pb=number(fields[46]),
                exchange_time=stamp.isoformat(timespec='seconds'),
                age_seconds=max(0, int((now - stamp).total_seconds())),
                stale=(now - stamp).total_seconds() > 180,
                source='腾讯财经公开报价', delay='供应商延迟无保证；非交易所授权逐笔行情')


def get_quotes(codes):
    keys = [symbol(code) for code in codes]
    def loader():
        text = fetch('https://qt.gtimg.cn/q=' + ','.join(keys), 'gb18030')
        rows, errors = [], []
        for code in codes:
            try:
                rows.append(parse_quote(text, code))
            except DataError as exc:
                errors.append(dict(code=code, error=str(exc)))
        if not rows:
            raise DataError('；'.join(e['code'] + '：' + e['error'] for e in errors))
        return dict(quotes=rows, errors=errors, source='腾讯财经公开报价')
    return cached(('quotes', tuple(codes)), 10, loader)


def parse_history(payload, code):
    key = symbol(code)
    obj = payload.get('data', {}).get(key, {})
    rows = obj.get('day')
    if payload.get('code') not in (None, 0) or not isinstance(rows, list) or not rows:
        raise DataError('历史源没有返回不复权日线；不使用其他复权口径静默替代')
    bars, seen = [], set()
    for row in rows:
        if not isinstance(row, list) or len(row) < 6:
            raise DataError('历史日线格式发生变化')
        date = str(row[0])
        try:
            if dt.date.fromisoformat(date).isoformat() != date:
                raise ValueError()
        except ValueError as exc:
            raise DataError('历史日线日期无效') from exc
        values = [number(x) for x in row[1:6]]
        if any(x is None for x in values):
            raise DataError('历史日线包含空值')
        op, close, high, low, volume = values
        if min(op, close, high, low) <= 0 or volume < 0 or high < max(op, close) or low > min(op, close) or date in seen:
            raise DataError('历史日线价格或重复日期无效')
        seen.add(date)
        bars.append(dict(code=code, date=date, open=op, close=close, high=high, low=low, volume=volume))
    bars.sort(key=lambda b: b['date'])
    # Intraday unfinished daily bars must not enter a close-based strategy.
    now = dt.datetime.now(SH)
    bars = [b for b in bars if b['date'] < now.date().isoformat() or
            (b['date'] == now.date().isoformat() and now.hour >= 16)]
    if not bars:
        raise DataError('没有已完成的日线')
    info = obj.get('qt', {}).get(key, [])
    name = info[1] if isinstance(info, list) and len(info) > 1 else code
    for bar in bars:
        bar['name'] = name
    return dict(code=code, name=name, bars=bars, adjustment='none',
                source='腾讯财经公开日线', volume_unit='手（以供应商口径为准）',
                first_date=bars[0]['date'], last_date=bars[-1]['date'],
                warnings=['不复权价格；未包含现金分红、送转、配股及退市收益，除权窗口回测可能失真',
                          '仅返回供应商可得的最近至多 640 根日线，不代表完整上市历史'])


def get_history(code):
    key = symbol(code)
    def loader():
        url = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?' + urllib.parse.urlencode({'param': key + ',day,,,640,'})
        return parse_history(decode_json(fetch(url)), code)
    return cached(('history', code), 300, loader)


def parse_hourly(payload, code, now=None):
    key = symbol(code)
    rows = payload.get('data', {}).get(key, {}).get('m60')
    if payload.get('code') != 0 or not isinstance(rows, list) or not rows:
        raise DataError('数据源没有返回 m60 K线，未用日线代替')
    now = now or dt.datetime.now(SH)
    bars, seen, excluded = [], set(), 0
    for row in rows:
        if not isinstance(row, list) or len(row) < 6:
            raise DataError('60分钟字段不完整')
        raw = str(row[0])
        if not re.fullmatch(r'(?:\d{12}|\d{14}|\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)', raw):
            raise DataError('60分钟时间格式发生变化')
        digits = re.sub(r'\D', '', raw)
        try:
            end = dt.datetime.strptime(digits[:12], '%Y%m%d%H%M').replace(tzinfo=SH)
        except ValueError as exc:
            raise DataError('60分钟日期无效') from exc
        if digits[8:12] not in ('1030', '1130', '1400', '1500') or end > now:
            excluded += 1
            continue
        values = [number(x) for x in row[1:6]]
        if any(x is None for x in values):
            raise DataError('60分钟价格缺失')
        op, close, high, low, volume = values
        stamp = end.isoformat(timespec='seconds')
        if min(op, close, high, low) <= 0 or volume < 0 or high < max(op, close) or low > min(op, close) or stamp in seen:
            raise DataError('60分钟价格或重复时间无效')
        seen.add(stamp)
        bars.append(dict(code=code, endTime=stamp, open=op, close=close, high=high, low=low, volume=volume))
    bars.sort(key=lambda b: b['endTime'])
    if not bars:
        raise DataError('没有符合 A股收盘时段的已完成60分钟K线')
    return dict(code=code, bars=bars, timeframe='60m', adjustment='none', source='腾讯财经60分钟K线',
                last_time=bars[-1]['endTime'], excluded_bars=excluded,
                session_ends='北京时间10:30、11:30、14:00、15:00；排除未完成K线')


def get_hourly(code):
    key = symbol(code)
    def loader():
        url = 'https://ifzq.gtimg.cn/appstock/app/kline/mkline?' + urllib.parse.urlencode({'param': key + ',m60,,320'})
        return parse_hourly(decode_json(fetch(url)), code)
    return cached(('hourly', code), 60, loader)


FINANCE_FIELDS = {
    'eps': ('BASIC_EPS', 'EPSJB'),
    'revenue': ('TOTAL_OPERATE_INCOME',),
    'profit': ('PARENT_NETPROFIT',),
    'revenue_yoy': ('YSTZ', 'TOTAL_OPERATE_INCOME_YOY'),
    'profit_yoy': ('SJLTZ', 'PARENT_NETPROFIT_YOY'),
    'roe': ('WEIGHTAVG_ROE', 'WEIGHTAVG_ROEYSTZ', 'ROEJQ'),
    'bps': ('BPS',), 'ocf_per_share': ('MGJYXJJE',),
    'gross_margin': ('XSMLL',),
}


def parse_financial(payload, code):
    result = payload.get('result')
    if payload.get('success') is False or not isinstance(result, dict) or not isinstance(result.get('data'), list):
        raise DataError('财务源未返回可用报表；接口字段或访问权限可能已变化')
    reports = []
    today = dt.datetime.now(SH).date().isoformat()
    for row in result['data']:
        if str(row.get('SECURITY_CODE', '')) != code:
            raise DataError('财务报表股票代码不匹配')
        date = str(row.get('REPORTDATE') or row.get('REPORT_DATE') or '')[:10]
        notice = str(row.get('NOTICE_DATE') or '')[:10]
        try:
            dt.date.fromisoformat(date)
            if notice:
                dt.date.fromisoformat(notice)
        except ValueError as exc:
            raise DataError('财务报表日期字段异常') from exc
        if date > today or (notice and notice > today):
            continue
        out = dict(code=code, name=row.get('SECURITY_NAME_ABBR') or code, period=date, notice_date=notice or None,
                   industry=row.get('PUBLISHNAME') or row.get('INDUSTRY_NAME') or None)
        for name, aliases in FINANCE_FIELDS.items():
            out[name] = next((number(row[k]) for k in aliases if k in row and number(row[k]) is not None), None)
        reports.append(out)
    reports.sort(key=lambda x: x['period'], reverse=True)
    if not reports or not any(reports[0][k] is not None for k in FINANCE_FIELDS):
        raise DataError('没有可识别的已披露财务数据')
    return dict(code=code, reports=reports, source='东方财富数据中心 · 业绩报表 RPT_LICO_FN_CPD',
                unit='收入、归母净利润：元；EPS、每股现金流：元/股；同比、ROE、毛利率：百分数',
                period_basis='年初至报告期末累计，非单季度、非 TTM；同比以供应商字段为准',
                warnings=['摘要不能替代公告原文和审计意见；财务真实性、关联交易和资产负债表未自动核验',
                          '公告日期缺失时不得作为历史时点已知数据；当前报表可能包含后续修订，禁止回填到技术回测'])


def get_financial(code):
    symbol(code)
    def loader():
        params = dict(reportName='RPT_LICO_FN_CPD', columns='ALL', filter=f'(SECURITY_CODE="{code}")',
                      pageNumber='1', pageSize='8', sortColumns='REPORTDATE', sortTypes='-1')
        return parse_financial(decode_json(fetch('https://datacenter-web.eastmoney.com/api/data/v1/get?' + urllib.parse.urlencode(params))), code)
    return cached(('financial', code), 3600, loader)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def respond(self, status, data):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if not url.path.startswith('/api/'):
            if url.path == '/':
                self.path = '/index.html'
            return super().do_GET()
        try:
            qs = urllib.parse.parse_qs(url.query)
            code = qs.get('code', [''])[0]
            if url.path == '/api/health':
                return self.respond(200, dict(status='ok', upstream_checked=False, note='服务存活不代表数据源连接成功'))
            if url.path == '/api/quotes':
                codes = list(dict.fromkeys(qs.get('codes', [''])[0].split(',')))
                if not 1 <= len(codes) <= 20:
                    raise InputError('每次仅支持 1—20 只观察股票')
                for value in codes:
                    symbol(value)
                return self.respond(200, get_quotes(codes))
            if url.path == '/api/roe-pool':
                try:
                    data = fetch_pool() if qs.get('refresh') == ['1'] else cached(('roe-pool', 2025), 3600, fetch_pool)
                    return self.respond(200, data)
                except PoolError as exc:
                    raise DataError(str(exc)) from exc
            if url.path == '/api/hourly':
                symbol(code)
                return self.respond(200, get_hourly(code))
            if url.path in ('/api/history', '/api/financial'):
                symbol(code)
                return self.respond(200, get_history(code) if url.path.endswith('history') else get_financial(code))
            return self.respond(404, dict(error='接口不存在'))
        except InputError as exc:
            return self.respond(400, dict(error=str(exc), simulated=False))
        except DataError as exc:
            return self.respond(502, dict(error=str(exc), simulated=False))
        except Exception:
            return self.respond(502, dict(error='数据响应异常；没有以演示数据替代真实数据', simulated=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8010)
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()
    print(f'知衡 API / web server, port {args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
