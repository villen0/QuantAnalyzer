import io
import math
import threading
from datetime import datetime, timedelta
from typing import Optional

import requests
import pandas as pd
from cachetools import TTLCache

_STOOQ_BASE = "https://stooq.com/q/d/l/"
_YF_SUMMARY = "https://query2.finance.yahoo.com/v10/finance/quoteSummary"
_YF_QUOTE   = "https://query1.finance.yahoo.com/v7/finance/quote"
_YF_SEARCH  = "https://query2.finance.yahoo.com/v1/finance/search"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com",
}

_PERIODS_TO_DAYS = {
    "1mo": 32, "3mo": 93, "6mo": 185, "1y": 366, "2y": 732, "5y": 1827,
}

_lock_info   = threading.RLock()
_lock_ohlcv  = threading.RLock()
_lock_price  = threading.RLock()
_lock_earn   = threading.RLock()
_lock_search = threading.RLock()

_cache_info   = TTLCache(maxsize=128, ttl=14400)  # 4h  — fundamentals
_cache_ohlcv  = TTLCache(maxsize=256, ttl=3600)   # 1h  — OHLCV
_cache_price  = TTLCache(maxsize=128, ttl=60)     # 60s — live price
_cache_earn   = TTLCache(maxsize=128, ttl=86400)  # 24h — earnings
_cache_search = TTLCache(maxsize=64,  ttl=600)    # 10min — search


# ── Helpers ──────────────────────────────────────────────────────────────────

def _raw(d: dict, *keys):
    """Extract raw float from Yahoo quoteSummary value (handles {raw:X, fmt:Y} objects)."""
    for k in keys:
        v = d.get(k)
        if v is None:
            continue
        if isinstance(v, dict):
            v = v.get("raw")
        if v is None:
            continue
        try:
            fv = float(v)
            if not math.isnan(fv):
                return fv
        except (ValueError, TypeError):
            pass
    return None


def _yf_summary(ticker: str) -> dict:
    """Fetch Yahoo Finance quoteSummary. Returns {} gracefully on any block/error."""
    modules = ",".join([
        "price", "summaryDetail", "defaultKeyStatistics",
        "financialData", "assetProfile", "earningsHistory",
    ])
    try:
        resp = requests.get(
            f"{_YF_SUMMARY}/{ticker.upper()}",
            params={"modules": modules, "corsDomain": "finance.yahoo.com"},
            headers=_HEADERS,
            timeout=10,
        )
        if resp.status_code in (401, 403, 429):
            return {}
        resp.raise_for_status()
        result = resp.json().get("quoteSummary", {}).get("result", None)
        return result[0] if result else {}
    except Exception:
        return {}


# ── OHLCV via Stooq (unlimited, no auth, no IP blocking) ─────────────────────

def _get_ohlcv_df(ticker: str, period: str) -> pd.DataFrame:
    cache_key = (ticker.upper(), period)
    with _lock_ohlcv:
        if cache_key in _cache_ohlcv:
            return _cache_ohlcv[cache_key]

    days  = _PERIODS_TO_DAYS.get(period, 93)
    end   = datetime.now()
    start = end - timedelta(days=days)

    resp = requests.get(
        _STOOQ_BASE,
        params={
            "s":  f"{ticker.lower()}.us",
            "d1": start.strftime("%Y%m%d"),
            "d2": end.strftime("%Y%m%d"),
            "i":  "d",
        },
        headers={"User-Agent": _HEADERS["User-Agent"]},
        timeout=10,
    )
    resp.raise_for_status()

    text = resp.text.strip()
    # Stooq returns HTML or plain-text error messages when data is unavailable.
    # Validate we actually got a CSV before handing it to pandas.
    if len(text) < 30 or text.startswith("<") or not text.lower().startswith("date"):
        raise ValueError(f"No price data for '{ticker}'. Check the symbol and try again.")

    try:
        df = pd.read_csv(io.StringIO(text), sep=",")
    except Exception as e:
        raise ValueError(f"Failed to parse price data for '{ticker}': {e}")

    df.columns = [c.strip() for c in df.columns]
    required = {"Date", "Open", "High", "Low", "Close", "Volume"}
    if not required.issubset(df.columns):
        raise ValueError(f"Unexpected data format for '{ticker}'. Try again later.")
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.set_index("Date").sort_index()
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()

    if df.empty:
        raise ValueError(f"No price data for '{ticker}'. Check the symbol and try again.")

    with _lock_ohlcv:
        _cache_ohlcv[cache_key] = df
    return df


def fetch_ohlcv(ticker: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    return _get_ohlcv_df(ticker, period)


def fetch_ohlcv_for_chart(ticker: str, period: str = "3mo", interval: str = "1d") -> list:
    df = _get_ohlcv_df(ticker, period)
    return [
        {
            "date":   ts.strftime("%Y-%m-%d %H:%M"),
            "open":   round(float(row["Open"]),   4),
            "high":   round(float(row["High"]),   4),
            "low":    round(float(row["Low"]),    4),
            "close":  round(float(row["Close"]),  4),
            "volume": int(row["Volume"]),
        }
        for ts, row in df.iterrows()
    ]


# ── Stock info via Yahoo quoteSummary ─────────────────────────────────────────

def fetch_stock_info(ticker: str) -> dict:
    key = ticker.upper()
    with _lock_info:
        if key in _cache_info:
            return _cache_info[key]

    qs = _yf_summary(key)
    pr = qs.get("price", {})
    sd = qs.get("summaryDetail", {})
    ks = qs.get("defaultKeyStatistics", {})
    fd = qs.get("financialData", {})
    ap = qs.get("assetProfile", {})

    name = pr.get("longName") or pr.get("shortName")

    # If Yahoo returned nothing, validate ticker via Stooq and continue with nulls
    if not name and not qs:
        try:
            _get_ohlcv_df(key, "1mo")  # raises ValueError for invalid tickers
        except ValueError:
            raise ValueError(f"Unknown ticker '{key}'. Check the symbol and try again.")
        name = key

    result = {
        "ticker":                 key,
        "name":                   name or key,
        "sector":                 ap.get("sector") or "N/A",
        "industry":               ap.get("industry") or "N/A",
        "market_cap":             _raw(pr, "marketCap") or _raw(sd, "marketCap"),
        "pe_ratio":               _raw(sd, "trailingPE"),
        "forward_pe":             _raw(sd, "forwardPE") or _raw(ks, "forwardPE"),
        "pb_ratio":               _raw(ks, "priceToBook"),
        "ps_ratio":               _raw(sd, "priceToSalesTrailing12Months"),
        "dividend_yield":         _raw(sd, "dividendYield") or _raw(sd, "trailingAnnualDividendYield"),
        "beta":                   _raw(sd, "beta") or _raw(ks, "beta"),
        "52w_high":               _raw(sd, "fiftyTwoWeekHigh"),
        "52w_low":                _raw(sd, "fiftyTwoWeekLow"),
        "avg_volume":             _raw(sd, "averageVolume"),
        "eps":                    _raw(ks, "trailingEps"),
        "forward_eps":            _raw(ks, "forwardEps"),
        "revenue":                _raw(fd, "totalRevenue"),
        "gross_margins":          _raw(fd, "grossMargins"),
        "operating_margins":      _raw(fd, "operatingMargins"),
        "profit_margins":         _raw(fd, "profitMargins"),
        "debt_to_equity":         _raw(fd, "debtToEquity"),
        "free_cashflow":          _raw(fd, "freeCashflow"),
        "current_price":          _raw(fd, "currentPrice") or _raw(pr, "regularMarketPrice"),
        "target_mean_price":      _raw(fd, "targetMeanPrice"),
        "recommendation":         fd.get("recommendationKey") or "N/A",
        "num_analyst_opinions":   int(_raw(fd, "numberOfAnalystOpinions")) if _raw(fd, "numberOfAnalystOpinions") else None,
        "short_ratio":            _raw(ks, "shortRatio"),
        "short_percent_of_float": _raw(ks, "shortPercentOfFloat"),
        "description":            ap.get("longBusinessSummary") or "",
        "website":                ap.get("website") or "",
        "country":                ap.get("country") or "",
        "employees":              ap.get("fullTimeEmployees") or None,
        "_source":                "stooq+yahoo-quotesummary",
    }

    with _lock_info:
        _cache_info[key] = result
    return result


# ── Real-time price ───────────────────────────────────────────────────────────

def fetch_realtime_price(ticker: str) -> dict:
    key = ticker.upper()
    with _lock_price:
        if key in _cache_price:
            return _cache_price[key]

    price = prev = change = change_pct = None

    # Primary: Yahoo v7/finance/quote (lightweight, usually not blocked)
    try:
        resp = requests.get(
            _YF_QUOTE,
            params={"symbols": key},
            headers=_HEADERS,
            timeout=8,
        )
        if resp.status_code == 200:
            q = resp.json().get("quoteResponse", {}).get("result", [{}])
            q = q[0] if q else {}
            price      = q.get("regularMarketPrice")
            prev       = q.get("regularMarketPreviousClose")
            change     = q.get("regularMarketChange")
            change_pct = q.get("regularMarketChangePercent")
    except Exception:
        pass

    # Fallback: last row of Stooq 5-day data
    if not price:
        try:
            df = _get_ohlcv_df(key, "1mo")
            last = df.iloc[-1]
            prev_row = df.iloc[-2] if len(df) >= 2 else last
            price      = float(last["Close"])
            prev       = float(prev_row["Close"])
            change     = round(price - prev, 2)
            change_pct = round((price - prev) / prev * 100, 2) if prev else 0.0
        except Exception:
            pass

    if not price:
        raise ValueError(f"No price available for '{key}'")

    price      = round(float(price), 2)
    prev       = round(float(prev), 2) if prev else price
    change     = round(float(change), 2) if change is not None else round(price - prev, 2)
    change_pct = round(float(change_pct), 2) if change_pct is not None else (
        round((price - prev) / prev * 100, 2) if prev else 0.0
    )

    result = {
        "ticker":     key,
        "price":      price,
        "prev_close": prev,
        "change":     change,
        "change_pct": change_pct,
        "volume":     None,
        "timestamp":  datetime.utcnow().isoformat(),
        "_source":    "yahoo-v7",
    }

    with _lock_price:
        _cache_price[key] = result
    return result


# ── Earnings history via Yahoo quoteSummary ───────────────────────────────────

def fetch_earnings_history(ticker: str) -> list:
    key = ticker.upper()
    with _lock_earn:
        if key in _cache_earn:
            return _cache_earn[key]
    try:
        qs      = _yf_summary(key)
        history = qs.get("earningsHistory", {}).get("history", [])
        if not history:
            return []

        def _safe(v):
            if isinstance(v, dict):
                v = v.get("raw")
            try:
                f = float(v)
                return None if math.isnan(f) else f
            except Exception:
                return None

        records = []
        for item in history[-4:][::-1]:
            ts_raw = item.get("quarter", {})
            if isinstance(ts_raw, dict):
                ts_raw = ts_raw.get("raw")
            try:
                dt = datetime.fromtimestamp(int(ts_raw))
                quarter = f"Q{((dt.month - 1) // 3) + 1} {dt.year}"
            except Exception:
                quarter = str(ts_raw)

            actual      = _safe(item.get("epsActual"))
            estimate    = _safe(item.get("epsEstimate"))
            surprise    = _safe(item.get("surprisePercent"))
            if surprise is not None:
                surprise = round(surprise * 100, 2)  # Yahoo returns as decimal (0.038 = 3.8%)

            records.append({
                "quarter":      quarter,
                "actual":       actual,
                "estimate":     estimate,
                "surprise_pct": surprise,
            })

        with _lock_earn:
            _cache_earn[key] = records
        return records
    except Exception:
        return []


# ── Symbol search via Yahoo ───────────────────────────────────────────────────

def search_symbols(query: str, limit: int = 8) -> list:
    cache_key = (query.strip().lower(), limit)
    with _lock_search:
        if cache_key in _cache_search:
            return _cache_search[cache_key]
    try:
        resp = requests.get(
            _YF_SEARCH,
            params={
                "q":                query.strip(),
                "quotesCount":      limit,
                "newsCount":        0,
                "enableFuzzyQuery": "true",
                "lang":             "en-US",
            },
            headers=_HEADERS,
            timeout=8,
        )
        resp.raise_for_status()
        allowed = {"EQUITY", "ETF", "INDEX"}
        out = [
            {
                "symbol":   item.get("symbol", ""),
                "name":     item.get("longname") or item.get("shortname") or "",
                "exchange": item.get("exchDisp") or item.get("exchange") or "",
                "type":     item.get("quoteType", ""),
            }
            for item in resp.json().get("quotes", [])
            if item.get("quoteType") in allowed
        ][:limit]
        with _lock_search:
            _cache_search[cache_key] = out
        return out
    except Exception:
        return []
