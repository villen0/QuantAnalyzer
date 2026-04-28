import requests
import pandas as pd
from datetime import datetime, timezone
from threading import Lock

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
}

_PERIOD_MAP = {
    "1mo": "1mo", "3mo": "3mo", "6mo": "6mo",
    "1y": "1y", "2y": "2y", "5y": "5y",
}

_session = requests.Session()
_session.headers.update(_HEADERS)
_crumb: str | None = None
_crumb_lock = Lock()


def _ensure_crumb() -> str:
    global _crumb
    with _crumb_lock:
        if _crumb:
            return _crumb
        _session.get("https://finance.yahoo.com/", timeout=10)
        r = _session.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            timeout=10,
        )
        r.raise_for_status()
        _crumb = r.text.strip()
        return _crumb


def _reset_crumb():
    global _crumb
    with _crumb_lock:
        _crumb = None


def _get(url: str, params: dict) -> requests.Response:
    params["crumb"] = _ensure_crumb()
    r = _session.get(url, params=params, timeout=15)
    if r.status_code in (401, 403):
        _reset_crumb()
        params["crumb"] = _ensure_crumb()
        r = _session.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r


def _chart(ticker: str, period: str = "3mo", interval: str = "1d") -> dict:
    r = _get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
        {"range": _PERIOD_MAP.get(period, "3mo"), "interval": interval,
         "includePrePost": "false", "events": "div,splits"},
    )
    result = r.json()["chart"]["result"]
    if not result:
        raise ValueError(f"No chart data for {ticker}")
    return result[0]


def _quote(ticker: str) -> dict:
    r = _get(
        "https://query1.finance.yahoo.com/v7/finance/quote",
        {"symbols": ticker},
    )
    result = r.json().get("quoteResponse", {}).get("result", [])
    if not result:
        raise ValueError(f"No quote for {ticker}")
    return result[0]


def _summary(ticker: str, modules: str) -> dict:
    r = _get(
        f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}",
        {"modules": modules},
    )
    result = r.json().get("quoteSummary", {}).get("result")
    if not result:
        raise ValueError(f"No summary data for {ticker}")
    return result[0]


def _raw(d: dict, key: str):
    val = d.get(key)
    if isinstance(val, dict):
        return val.get("raw")
    return val


def fetch_stock_info(ticker: str) -> dict:
    q = _quote(ticker)
    s = _summary(ticker, "summaryDetail,financialData,defaultKeyStatistics,assetProfile")
    sd = s.get("summaryDetail", {})
    fd = s.get("financialData", {})
    ks = s.get("defaultKeyStatistics", {})
    ap = s.get("assetProfile", {})

    return {
        "ticker": ticker.upper(),
        "name": q.get("longName") or q.get("shortName") or ticker.upper(),
        "sector": ap.get("sector", "N/A"),
        "industry": ap.get("industry", "N/A"),
        "market_cap": q.get("marketCap"),
        "pe_ratio": q.get("trailingPE") or _raw(sd, "trailingPE"),
        "forward_pe": q.get("forwardPE") or _raw(sd, "forwardPE"),
        "pb_ratio": _raw(ks, "priceToBook"),
        "ps_ratio": _raw(sd, "priceToSalesTrailing12Months"),
        "dividend_yield": q.get("dividendYield") or _raw(sd, "dividendYield"),
        "beta": q.get("beta") or _raw(sd, "beta"),
        "52w_high": q.get("fiftyTwoWeekHigh"),
        "52w_low": q.get("fiftyTwoWeekLow"),
        "avg_volume": q.get("averageDailyVolume3Month") or q.get("averageDailyVolume10Day"),
        "eps": q.get("epsTrailingTwelveMonths") or _raw(ks, "trailingEps"),
        "forward_eps": q.get("epsForward") or _raw(ks, "forwardEps"),
        "revenue": _raw(fd, "totalRevenue"),
        "gross_margins": _raw(fd, "grossMargins"),
        "operating_margins": _raw(fd, "operatingMargins"),
        "profit_margins": _raw(fd, "profitMargins"),
        "debt_to_equity": _raw(fd, "debtToEquity"),
        "free_cashflow": _raw(fd, "freeCashflow"),
        "current_price": q.get("regularMarketPrice"),
        "target_mean_price": _raw(fd, "targetMeanPrice"),
        "recommendation": _raw(fd, "recommendationKey") or "N/A",
        "num_analyst_opinions": _raw(fd, "numberOfAnalystOpinions"),
        "short_ratio": _raw(ks, "shortRatio"),
        "short_percent_of_float": _raw(ks, "shortPercentOfFloat"),
        "description": ap.get("longBusinessSummary", ""),
        "website": ap.get("website", ""),
        "country": ap.get("country", ""),
        "employees": ap.get("fullTimeEmployees"),
        "_source": "live",
    }


def _parse_chart(res: dict) -> list[dict]:
    timestamps = res.get("timestamp", [])
    quote = res["indicators"]["quote"][0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    records = []
    for i, ts in enumerate(timestamps):
        c = closes[i] if i < len(closes) else None
        if c is None:
            continue
        records.append({
            "date": datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "open": round(float(opens[i] if i < len(opens) and opens[i] is not None else c), 4),
            "high": round(float(highs[i] if i < len(highs) and highs[i] is not None else c), 4),
            "low": round(float(lows[i] if i < len(lows) and lows[i] is not None else c), 4),
            "close": round(float(c), 4),
            "volume": int(volumes[i]) if i < len(volumes) and volumes[i] is not None else 0,
        })
    return records


def fetch_ohlcv(ticker: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    res = _chart(ticker, period, interval)
    bars = _parse_chart(res)
    if not bars:
        raise ValueError(f"Empty OHLCV for {ticker}")
    df = pd.DataFrame([{
        "Open": b["open"], "High": b["high"], "Low": b["low"],
        "Close": b["close"], "Volume": b["volume"],
        "Dividends": 0, "Stock Splits": 0,
    } for b in bars])
    df.index = pd.to_datetime([b["date"] for b in bars])
    return df


def fetch_ohlcv_for_chart(ticker: str, period: str = "3mo", interval: str = "1d") -> list:
    res = _chart(ticker, period, interval)
    bars = _parse_chart(res)
    if not bars:
        raise ValueError(f"Empty chart data for {ticker}")
    return bars


def fetch_realtime_price(ticker: str) -> dict:
    q = _quote(ticker)
    price = q.get("regularMarketPrice")
    if not price:
        raise ValueError(f"No price for {ticker}")
    prev_close = q.get("regularMarketPreviousClose") or price
    return {
        "ticker": ticker.upper(),
        "price": round(float(price), 2),
        "prev_close": round(float(prev_close), 2) if prev_close else None,
        "change": round(float(q.get("regularMarketChange", 0.0)), 2),
        "change_pct": round(float(q.get("regularMarketChangePercent", 0.0)), 2),
        "volume": q.get("regularMarketVolume"),
        "timestamp": datetime.utcnow().isoformat(),
        "_source": "live",
    }


def fetch_earnings_history(ticker: str) -> list:
    try:
        s = _summary(ticker, "earningsHistory")
        history = s.get("earningsHistory", {}).get("history", [])
        return [
            {
                "quarter": item.get("period", ""),
                "actual": _raw(item, "epsActual"),
                "estimate": _raw(item, "epsEstimate"),
                "surprise_pct": _raw(item, "surprisePercent"),
            }
            for item in history[:4]
        ]
    except Exception:
        return []
