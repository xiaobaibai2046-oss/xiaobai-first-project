"""Analysis of normalized real OHLCV bars; independent of strategy thresholds."""

def metrics(bars):
    closes=[float(b['close']) for b in bars]
    def ma(n):return sum(closes[-n:])/n if len(closes)>=n else None
    e12=e26=closes[0] if closes else 0.;dea=0.;dif=0.
    for close in closes:
        e12+=(close-e12)*2/13;e26+=(close-e26)*2/27;dif=e12-e26;dea+=(dif-dea)*2/10
    rsi=None
    if len(closes)>=15:
        changes=[b-a for a,b in zip(closes,closes[1:])]
        gain=sum(max(x,0) for x in changes[:14])/14;loss=sum(max(-x,0) for x in changes[:14])/14
        for x in changes[14:]:gain=(gain*13+max(x,0))/14;loss=(loss*13+max(-x,0))/14
        rsi=100-100/(1+gain/loss) if loss else 100. if gain else 50.
    return {'MA5':ma(5),'MA10':ma(10),'MA20':ma(20),'MACD':{'DIF':dif,'DEA':dea,'histogram':2*(dif-dea),'ema_seed':'first_close'},'RSI14':rsi,'bar_count':len(closes),'warmup_note':'30日验收可计算MA5/20；MACD正式策略仍要求至少100根完整小时线'}
