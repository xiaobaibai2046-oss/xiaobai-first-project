"""Fetch the complete source-covered 2025 A-share annual-report universe."""
import datetime as dt
import json
import math
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

YEAR = 2025
REPORT_DATE = '2025-12-31'
THRESHOLD = 10
PAGE_SIZE = 500
FILTER = '(REPORTDATE=\'2025-12-31\')(SECURITY_TYPE_CODE="058001001")'
COLUMNS = 'SECURITY_CODE,SECURITY_NAME_ABBR,SECUCODE,SECURITY_TYPE_CODE,TRADE_MARKET,REPORTDATE,NOTICE_DATE,UPDATE_DATE,WEIGHTAVG_ROE,PUBLISHNAME'
BASE_URL = 'https://datacenter-web.eastmoney.com/api/data/v1/get'
SH = ZoneInfo('Asia/Shanghai')


class PoolError(Exception):
    pass


def normalize_page(payload, page_size=PAGE_SIZE):
    result = payload.get('result')
    if payload.get('success') is False or not isinstance(result, dict) or not isinstance(result.get('data'), list):
        raise PoolError('年报分页未返回有效数据')
    count, pages = result.get('count'), result.get('pages')
    if isinstance(count, bool) or not isinstance(count, int) or count <= 0 or not isinstance(pages, int) or pages != math.ceil(count / page_size) or pages > 50:
        raise PoolError('年报分页总数不一致或超出支持范围')
    return dict(count=count, pages=pages, rows=result['data'])


def build_pool(pages, now=None, page_size=PAGE_SIZE):
    now = now or dt.datetime.now(SH)
    if not pages:
        raise PoolError('尚未读取年报分页')
    first = pages[0]
    if len(pages) != first['pages'] or any(p['count'] != first['count'] or p['pages'] != first['pages'] for p in pages):
        raise PoolError('分页缺失或抓取期间总数变化，保留原股票池')
    for i, page in enumerate(pages):
        expected = page_size if i < first['pages'] - 1 else first['count'] - page_size * i
        if len(page['rows']) != expected:
            raise PoolError('分页记录数量不完整，保留原股票池')
    rows = [row for page in pages for row in page['rows']]
    stocks, seen = [], set()
    stats = dict(source_records=len(rows), source_pages=len(pages), covered_a_shares=0, qualified=0,
                 missing_roe=0, not_above_threshold=0, outside_scope=0, future_notice=0,
                 missing_notice=0, by_market={})
    today = now.date().isoformat()
    for row in rows:
        code = str(row.get('SECURITY_CODE', ''))
        if str(row.get('REPORTDATE', ''))[:10] != REPORT_DATE or row.get('SECURITY_TYPE_CODE') != '058001001':
            raise PoolError('来源混入非2025年报或非A股记录，停止更新')
        secucode = str(row.get('SECUCODE', ''))
        if not re.fullmatch(r'\d{6}', code) or secucode not in (code+'.SH', code+'.SZ', code+'.BJ'):
            stats['outside_scope'] += 1
            continue
        if code in seen:
            raise PoolError('年报出现重复股票代码，无法确认全量抓取')
        seen.add(code)
        if not isinstance(row.get('SECURITY_NAME_ABBR'), str) or not row['SECURITY_NAME_ABBR']:
            raise PoolError('股票名称缺失')
        notice = str(row.get('NOTICE_DATE') or '')[:10]
        if notice:
            try:
                dt.date.fromisoformat(notice)
            except ValueError as exc:
                raise PoolError('年报公告日期异常') from exc
            if notice > today:
                stats['future_notice'] += 1
                continue
        else:
            stats['missing_notice'] += 1
        stats['covered_a_shares'] += 1
        market = row.get('TRADE_MARKET') or secucode[-2:]
        stats['by_market'][market] = stats['by_market'].get(market, 0) + 1
        raw = row.get('WEIGHTAVG_ROE')
        try:
            roe = None if raw in (None, '', '-', '--') or isinstance(raw, bool) else float(raw)
        except (ValueError, TypeError):
            roe = None
        if roe is None or not math.isfinite(roe):
            stats['missing_roe'] += 1
            continue
        if roe <= THRESHOLD:
            stats['not_above_threshold'] += 1
            continue
        stocks.append(dict(code=code, name=row['SECURITY_NAME_ABBR'], roe=roe,
                           report_date=REPORT_DATE, notice_date=notice or None,
                           market=market, exchange=secucode[-2:], industry=row.get('PUBLISHNAME') or '未提供'))
    stocks.sort(key=lambda s: (-s['roe'], s['code']))
    stats['qualified'] = len(stocks)
    if stats['covered_a_shares'] != stats['qualified'] + stats['missing_roe'] + stats['not_above_threshold']:
        raise PoolError('覆盖数量核对失败')
    return dict(schema_version=1, year=YEAR, report_date=REPORT_DATE, threshold=THRESHOLD,
                comparison='>', roe_metric='2025年年报加权平均净资产收益率（%）', complete=True,
                as_of=now.isoformat(timespec='seconds'), source='东方财富数据中心 · RPT_LICO_FN_CPD',
                source_url=BASE_URL, source_filter=FILTER,
                coverage='来源覆盖的沪深北A股2025年年报；不额外排除ST、行业或板块。未披露或来源未覆盖的公司数量不能由本年报表推定，未核验当前上市状态。',
                stats=stats, stocks=stocks)


def fetch_pool(progress=None):
    pages = []
    page_number = 1
    while True:
        params = dict(reportName='RPT_LICO_FN_CPD', columns=COLUMNS, filter=FILTER,
                      pageSize=PAGE_SIZE, pageNumber=page_number, sortColumns='SECURITY_CODE', sortTypes='1')
        request = urllib.request.Request(BASE_URL+'?'+urllib.parse.urlencode(params), headers={'User-Agent':'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read(8_000_001)
                if len(raw) > 8_000_000:
                    raise PoolError('年报响应过大')
                page = normalize_page(json.loads(raw))
        except PoolError:
            raise
        except Exception as exc:
            raise PoolError(f'第{page_number}页读取失败，原股票池未替换') from exc
        if pages and (page['count'] != pages[0]['count'] or page['pages'] != pages[0]['pages']):
            raise PoolError('抓取期间分页总数变化，请稍后重试')
        pages.append(page)
        if progress:
            progress(page_number, page['pages'], page['count'])
        if page_number == page['pages']:
            break
        page_number += 1
    return build_pool(pages)
