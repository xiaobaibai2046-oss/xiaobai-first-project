"""Official TdxAiData adapter, bounded native RPC, units and source provenance."""
import datetime as dt
import fnmatch
import json
import math
import os
from pathlib import Path
import re
import selectors
import subprocess
import sys
import threading
import time
from zoneinfo import ZoneInfo
from trading_sessions import is_trading_day

SH=ZoneInfo('Asia/Shanghai')
SOURCE='通达信官方 TdxAiData 1.3.1'
MESSAGES={
 'authentication':'通达信认证未通过', 'permission':'通达信接口权限不足',
 'credits':'通达信积分或额度不足', 'network':'通达信网络连接异常',
 'network_policy':'当前云环境未授权通达信原生TCP连接',
 'rate_limit':'通达信请求频率受限', 'budget':'本采集进程调用预算已用尽',
 'unavailable':'通达信未返回可用数据，不能据此推定权限或积分不足',
 'schema':'通达信数据格式或单位尚未通过核验',
 'not_configured':'未配置通达信后端认证', 'sdk_missing':'官方SDK或依赖未安装',
 'disabled':'未启用专业数据接口'}

class TdxError(Exception):
    def __init__(self,category):
        self.category=category;super().__init__(MESSAGES.get(category,MESSAGES['unavailable']))
    def public(self):return {'category':self.category,'message':str(self)}

def classify_error(text):
    text=str(text).lower()
    for pattern,category in [(r'积分|余额|credits|insufficient.*(?:balance|points)|points.*(?:insufficient|exhausted)','credits'),(r'权限|permission|not entitled|订阅','permission'),(r'认证|token|unauthor|鉴权|credentials','authentication'),(r'频率|限流|rate.?limit|too many','rate_limit'),(r'timeout|timed out|超时|connect|网络|连接|dns','network'),(r'no module|not found.*library|动态库','sdk_missing')]:
        if re.search(pattern,text):return {'category':category,'message':MESSAGES[category]}
    return {'category':'unavailable','message':MESSAGES['unavailable']}

def symbol(code):
    if not re.fullmatch(r'\d{6}',code or ''):raise TdxError('schema')
    suffix='SH' if code.startswith(('60','68')) else 'SZ' if code.startswith(('00','30')) else 'BJ' if code.startswith(('43','83','87','92')) else None
    if not suffix:raise TdxError('schema')
    return code+'.'+suffix

def check_network_policy():
    path=Path('/etc/codex/network-policy.json')
    if not path.exists():return  # External deployment uses that host's own network policy.
    try:
        policy=json.loads(path.read_text());allowed=policy.get('tcp_network_access',{}).get('domains',[])
        if not all(any(isinstance(p,str) and fnmatch.fnmatchcase(h,p) for p in allowed) for h in ('aihs.tdx.com.cn','aihs2.tdx.com.cn','aids.tdx.com.cn')):raise TdxError('network_policy')
    except (OSError,ValueError):raise TdxError('network_policy')

def num(value):
    if value is None or isinstance(value,bool):raise TdxError('schema')
    try:n=float(value)
    except (TypeError,ValueError):raise TdxError('schema')
    if not math.isfinite(n):raise TdxError('schema')
    return n

def optional(value):
    try:return num(value)
    except TdxError:return None

def normalize_bars(payload,code,period,now=None,adjustment='none'):
    now=now or dt.datetime.now(SH);sid=symbol(code)
    try:
        frame=payload['Close'];index=frame['index'];columns={k:payload[k]['columns'][sid] for k in ('Open','High','Low','Close','Volume','Amount')}
        if not index or any(payload[k]['index']!=index or len(v)!=len(index) for k,v in columns.items()):raise TdxError('schema')
        bars=[];forming=[];seen=set()
        for i,raw in enumerate(index):
            stamp=dt.datetime.fromisoformat(raw).replace(tzinfo=SH) if dt.datetime.fromisoformat(raw).tzinfo is None else dt.datetime.fromisoformat(raw).astimezone(SH)
            key=stamp.date().isoformat() if period=='1d' else stamp.isoformat(timespec='seconds')
            if key in seen:raise TdxError('schema')
            seen.add(key)
            op,high,low,close,shares,amount=[num(columns[k][i]) for k in ('Open','High','Low','Close','Volume','Amount')]
            if min(op,high,low,close)<=0 or shares<0 or amount<0 or high<max(op,close) or low>min(op,close):raise TdxError('schema')
            bar=dict(code=code,open=op,high=high,low=low,close=close,volume=shares/100,volume_shares=shares,amount_cny=amount*10000)
            bar['date' if period=='1d' else 'endTime']=key
            if period=='1d':complete=stamp.date()<now.date() or stamp.date()==now.date() and now.hour>=15
            else:complete=stamp<=now
            if period=='1h' and stamp.strftime('%H:%M') not in ('10:30','11:30','14:00','15:00'):raise TdxError('schema')
            (bars if complete else forming).append(bar)
        bars.sort(key=lambda b:b.get('date',b.get('endTime')))
        if not bars:raise TdxError('unavailable')
    except (KeyError,TypeError,ValueError):raise TdxError('schema')
    data=dict(code=code,name=code,bars=bars,forming_bar=forming[-1] if forming else None,adjustment=adjustment,source=SOURCE,volume_unit='手（SDK股数÷100）',amount_unit='元（SDK万元×10000）',timeframe=period)
    if period=='1d':data.update(first_date=bars[0]['date'],last_date=bars[-1]['date'])
    else:data.update(last_time=bars[-1]['endTime'])
    return data

def normalize_snapshot(raw,code):
    if not isinstance(raw,dict):raise TdxError('schema')
    raw=raw.get('Value',raw)
    if not isinstance(raw,dict):raise TdxError('schema')
    price=num(raw.get('Now'));previous=optional(raw.get('LastClose'))
    if price<=0:raise TdxError('schema')
    # The documented snapshot schema does not guarantee an exchange timestamp or Amount multiplier.
    # Never replace a missing exchange timestamp with the collection time.
    q=dict(code=code,name=str(raw.get('Name') or code),price=price,previous_close=previous,change_pct=(price/previous-1)*100 if previous and previous>0 else None,open=optional(raw.get('Open')),high=optional(raw.get('Max',raw.get('High'))),low=optional(raw.get('Min',raw.get('Low'))),volume_lots=optional(raw.get('Volume')),amount_raw=optional(raw.get('Amount')),amount_unit='SDK快照原值；官方字段表未明示倍率',amount_10k_cny=None,exchange_time=None,age_seconds=None,stale=True,timestamp_status='供应商未提供已核验交易所时点',source=SOURCE)
    bids=[];asks=[]
    for n in range(1,6):
        bids.append({'price':optional(raw.get('Bid'+str(n))),'volume_raw':optional(raw.get('BidVol'+str(n)))})
        asks.append({'price':optional(raw.get('Ask'+str(n))),'volume_raw':optional(raw.get('AskVol'+str(n)))})
    depth={'bids':bids,'asks':asks,'status':'available' if all(x['price'] is not None for x in bids+asks) else 'field_unavailable','note':'字段缺失不等于权限不足；官方说明非报价界面买二至买五可能为空'}
    return {'quotes':[q],'depth':depth,'source':SOURCE}

class Provider:
    def __init__(self,timeout=25,min_interval=1,max_calls=None):
        self.timeout=timeout;self.min_interval=min_interval;self.max_calls=max_calls if max_calls is not None else max(1,int(os.environ.get('TDX_MAX_CALLS','100')))
        self.calls=0;self.process=None;self.lock=threading.RLock();self.last_call=0;self.cache={};self.circuit={}
    def configured(self):return bool(os.environ.get('TDX_DATA_KEY') or os.environ.get('TDX_CONFIG_FILE'))
    def close(self):
        if self.process:
            self.process.kill();self.process.wait();self.process=None
    def raw(self,operation,code,**params):
        sid=symbol(code)
        if not self.configured():raise TdxError('not_configured')
        check_network_policy()
        circuit_key=(operation,params.get('period',''))
        market_key=circuit_key+(sid.split('.')[-1],)
        symbol_key=circuit_key+(sid,)
        until,category=self.circuit.get('global',self.circuit.get(market_key,self.circuit.get(symbol_key,self.circuit.get(circuit_key,(0,'unavailable')))))
        if time.monotonic()<until:raise TdxError(category)
        if self.calls>=self.max_calls:self.close();raise TdxError('budget')
        if self.process is None or self.process.poll() is not None:
            self.process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('tdx_sdk_worker.py'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
        for attempt in range(2):
            if self.calls>=self.max_calls:self.close();raise TdxError('budget')
            time.sleep(max(0,self.min_interval-(time.monotonic()-self.last_call)));self.last_call=time.monotonic();self.calls+=1
            try:
                self.process.stdin.write(json.dumps({'operation':operation,'symbol':sid,**params})+'\n');self.process.stdin.flush()
                with selectors.DefaultSelector() as selector:
                    selector.register(self.process.stdout,selectors.EVENT_READ)
                    if not selector.select(self.timeout):self.close();raise TdxError('network')
                packet=json.loads(self.process.stdout.readline())
                if packet.get('ok'):return packet['data']
                category=packet.get('error',{}).get('category','unavailable')
                if category not in MESSAGES:category='unavailable'
                raise TdxError(category)
            except (BrokenPipeError,OSError,ValueError):self.close();raise TdxError('network')
            except TdxError as exc:
                scope='global' if exc.category in ('authentication','credits') else market_key if exc.category=='permission' else symbol_key if exc.category in ('unavailable','schema') else circuit_key
                self.circuit[scope]=(time.monotonic()+(300 if exc.category in ('authentication','permission','credits','unavailable') else 30),exc.category)
                # Never retry chargeable entitlement failures. Retry only an explicit native network response.
                if exc.category=='network' and attempt==0 and self.process is not None:time.sleep(1);continue
                raise
    def get(self,kind,code,count=80,period=None,adjustment=None):
        with self.lock:
            adjustment=adjustment or os.environ.get('TDX_ADJUSTMENT','none')
            if adjustment not in ('none','front'):raise TdxError('schema')
            now=dt.datetime.now(SH);period=period or ('1d' if kind=='history' else '1h')
            if kind not in ('quote','history','hourly','minutes','depth','ticks','funds'):raise TdxError('schema')
            if period not in ('1d','1h','1m','5m','15m','30m'):raise TdxError('schema')
            if not isinstance(count,int) or not 1<=count<=640:raise TdxError('schema')
            if kind in ('ticks','funds') and os.environ.get('TDX_ENABLE_PRO')!='true':raise TdxError('disabled')
            trading=is_trading_day(now.date()) and ('09:30'<=now.strftime('%H:%M')<='11:30' or '13:00'<=now.strftime('%H:%M')<='15:00')
            ttl=(10 if trading else 300) if kind in ('quote','depth') else 60 if kind in ('hourly','minutes') else 300
            from cloud_cache import expected
            session=expected(now,'history' if kind=='history' else 'hourly')
            key=(kind,code,count,period,session,adjustment)
            old=self.cache.get(key)
            if old and time.monotonic()-old[0]<ttl:return dict(old[1],cache_hit=True)
            if kind in ('quote','depth'):
                shared=('snapshot',code)
                cached=self.cache.get(shared)
                if cached and time.monotonic()-cached[0]<ttl:data=cached[1]
                else:data=normalize_snapshot(self.raw('snapshot',code),code);self.cache[shared]=(time.monotonic(),data)
            elif kind in ('history','hourly','minutes'):data=normalize_bars(self.raw('bars',code,period=period,count=count,adjustment=adjustment),code,period,now,adjustment)
            else:
                raw=self.raw(kind,code,date=now.date().isoformat());data={'code':code,'data':raw,'source':SOURCE,'date':now.date().isoformat()}
            if 'bars' in data:
                from market_metrics import metrics
                data['analysis']=metrics(data['bars'])
            data=dict(data,fetched_at=now.isoformat(),cache_hit=False,provider='tdx_official')
            if len(self.cache)>200:self.cache.clear()
            self.cache[key]=(time.monotonic(),data)
            return data

_default=None
def default_provider():
    global _default
    if _default is None:_default=Provider()
    return _default
