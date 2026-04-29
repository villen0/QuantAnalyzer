import os
import time
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta

_BASE = "https://finnhub.io/api/v1"
_HEADERS = {"User-Agent": "QuantAnalyzer/1.0"}

_PERIOD_DAYS = {
    "1mo": 30, "3mo": 90, "6mo": 180,
    "1y": 365, "2y": 730, "5y": 1825,
}


def _key() -> str:
    k = os.environ.get("FINNHUB_API_KEY", "")
    if not k:
        raise RuntimeError(
            "FINNHUB_API_KEY is not set. "
            "Get a free key at finnhub.io and add it to your Render environment."
        )
    return k


def _get(path: str, **params) -> any:
    params["token"] = _key()
    for attempt in range(3):
        r = requests.get(f"{_BASE}{path}", params=params, headers=_HEADERS, timeout=15)
        if r.status_code == 429:
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("Finnhub rate limit exceeded — please try again in a moment.")


def fetch_stock_info(ticker: str) -> dict:
    profile  = _get("/stock/profile2", symbol=ticker)
    if not profile or not profile.get("name"):
        raise ValueError(f"Unknown ticker '{ticker}'. Check the symbol and try again.")

    metrics  = _get("/stock/metric", symbol=ticker, metric="all").get("metric", {})
    quote    = _get("/quote", symbol=ticker)

    try:
        targets = _get("/stock/price-target", symbol=ticker)
        target_price = targets.get("targetMean")
    except Exception:
        target_price = None

    try:
        recs = _get("/stock/recommendation", symbol=ticker)
        rec = recs[0] if recs else {}
        total = sum(rec.get(k, 0) for k in ("buy", "strongBuy", "hold", "sell", "strongSell"))
        buy_pct = (rec.get("buy", 0) + rec.get("strongBuy", 0)) / total if total else 0
        recommendation = "buy" if buy_pct > 0.6 else "sell" if buy_pct < 0.35 else "hold"
    except Exception:
        recommendation = "N/A"

    shares = profile.get("shareOutstanding") or 0  # millions
    cap_m  = profile.get("marketCapitalization") or 0  # millions

    def pct(v):
        return v / 100 if v is not None else None

    return {
        "ticker":                  ticker.upper(),
        "name":                    profile.get("name", ticker.upper()),
        "sector":                  profile.get("finnhubIndustry", "N/A"),
        "industry":                profile.get("finnhubIndustry", "N/A"),
        "market_cap":              cap_m * 1e6 if cap_m else None,
        "pe_ratio":                metrics.get("peTTM") or metrics.get("peAnnual"),
        "forward_pe":              metrics.get("forwardPE"),
        "pb_ratio":                metrics.get("pbAnnual"),
        "ps_ratio":                metrics.get("psTTM") or metrics.get("psAnnual"),
        "dividend_yield":          metrics.get("dividendYieldIndicatedAnnual"),
        "beta":                    metrics.get("beta"),
        "52w_high":                metrics.get("52WeekHigh"),
        "52w_low":                 metrics.get("52WeekLow"),
        "avg_volume":              int(metrics["10DayAverageTradingVolume"] * 1e6) if metrics.get("10DayAverageTradingVolume") else None,
        "eps":                     metrics.get("epsTTM") or metrics.get("epsAnnual"),
        "forward_eps":             None,
        "revenue":                 (metrics["revenuePerShareTTM"] * shares * 1e6) if metrics.get("revenuePerShareTTM") and shares else None,
        "gross_margins":           pct(metrics.get("grossMarginTTM") or metrics.get("grossMarginAnnual")),
        "operating_margins":       pct(metrics.get("operatingMarginTTM") or metrics.get("operatingMarginAnnual")),
        "profit_margins":          pct(metrics.get("netProfitMarginTTM") or metrics.get("netProfitMarginAnnual")),
        "debt_to_equity":          metrics.get("totalDebt/totalEquityAnnual"),
        "free_cashflow":           (metrics["freeCashFlowPerShareAnnual"] * shares * 1e6) if metrics.get("freeCashFlowPerShareAnnual") and shares else None,
        "current_price":           quote.get("c"),
        "target_mean_price":       target_price,
        "recommendation":          recommendation,
        "num_analyst_opinions":    None,
        "short_ratio":             metrics.get("shortInterestRatio"),
        "short_percent_of_float":  None,
        "description":             "",
        "website":                 profile.get("weburl", ""),
        "country":                 profile.get("country", ""),
        "employees":               None,
        "_source":                 "live",
    }


def _candles_finnhub(ticker: str, period: str) -> list[dict]:
    """Fetch OHLCV from Finnhub (requires premium plan for /stock/candle)."""
    days = _PERIOD_DAYS.get(period, 90)
    now  = datetime.now(timezone.utc)
    data = _get(
        "/stock/candle",
        symbol=ticker,
        resolution="D",
        **{"from": int((now - timedelta(days=days)).timestamp()), "to": int(now.timestamp())},
    )
    if data.get("s") != "ok":
        raise ValueError(f"No candle data for {ticker}")
    records = []
    for i, ts in enumerate(data.get("t", [])):
        records.append({
            "date":   datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "open":   round(float(data["o"][i]), 4),
            "high":   round(float(data["h"][i]), 4),
            "low":    round(float(data["l"][i]), 4),
            "close":  round(float(data["c"][i]), 4),
            "volume": int(data["v"][i]),
        })
    return records


def _candles_stooq(ticker: str, period: str) -> list[dict]:
    """Free OHLCV fallback via Stooq — no API key required."""
    days     = _PERIOD_DAYS.get(period, 90)
    today    = datetime.now(timezone.utc).date()
    from_d   = (today - timedelta(days=days)).strftime("%Y%m%d")
    to_d     = today.strftime("%Y%m%d")

    # Stooq uses lowercase ticker with .us suffix for US equities
    for symbol in (f"{ticker.lower()}.us", ticker.lower()):
        try:
            url = f"https://stooq.com/q/d/l/?s={symbol}&d1={from_d}&d2={to_d}&i=d"
            r = requests.get(url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            lines = [l for l in r.text.strip().splitlines() if l and not l.startswith("Date")]
            if not lines:
                continue
            records = []
            for line in lines:
                parts = line.split(",")
                if len(parts) < 5:
                    continue
                date_s, o, h, l, c = parts[0], parts[1], parts[2], parts[3], parts[4]
                vol = parts[5].strip() if len(parts) > 5 else "0"
                records.append({
                    "date":   datetime.strptime(date_s, "%Y-%m-%d").strftime("%Y-%m-%d %H:%M"),
                    "open":   round(float(o), 4),
                    "high":   round(float(h), 4),
                    "low":    round(float(l), 4),
                    "close":  round(float(c), 4),
                    "volume": int(float(vol)) if vol else 0,
                })
            if records:
                # Stooq returns newest-first; reverse to chronological order
                records.sort(key=lambda x: x["date"])
                return records
        except Exception:
            continue
    return []


def _fetch_bars(ticker: str, period: str) -> list[dict]:
    """Try Finnhub candles, fall back to Stooq on 403/permission error."""
    try:
        bars = _candles_finnhub(ticker, period)
        if bars:
            return bars
    except Exception as e:
        if "403" not in str(e) and "Forbidden" not in str(e) and "No candle" not in str(e):
            raise  # re-raise non-permission errors (network, bad ticker, etc.)

    bars = _candles_stooq(ticker, period)
    if not bars:
        raise ValueError(
            f"Could not fetch price history for {ticker}. "
            "Check the ticker symbol and try again."
        )
    return bars


def fetch_ohlcv(ticker: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    bars = _fetch_bars(ticker, period)
    df = pd.DataFrame([{
        "Open": b["open"], "High": b["high"], "Low": b["low"],
        "Close": b["close"], "Volume": b["volume"],
        "Dividends": 0, "Stock Splits": 0,
    } for b in bars])
    df.index = pd.to_datetime([b["date"] for b in bars])
    return df


def fetch_ohlcv_for_chart(ticker: str, period: str = "3mo", interval: str = "1d") -> list:
    return _fetch_bars(ticker, period)


def fetch_realtime_price(ticker: str) -> dict:
    q = _get("/quote", symbol=ticker)
    price = q.get("c")
    if not price:
        raise ValueError(f"No price for {ticker}")
    return {
        "ticker":     ticker.upper(),
        "price":      round(float(price), 2),
        "prev_close": round(float(q.get("pc") or price), 2),
        "change":     round(float(q.get("d") or 0), 2),
        "change_pct": round(float(q.get("dp") or 0), 2),
        "volume":     None,
        "timestamp":  datetime.utcnow().isoformat(),
        "_source":    "live",
    }


def fetch_earnings_history(ticker: str) -> list:
    try:
        data = _get("/stock/earnings", symbol=ticker)
        return [
            {
                "quarter":      f"{item.get('year', '')} Q{item.get('quarter', '')}",
                "actual":       item.get("actual"),
                "estimate":     item.get("estimate"),
                "surprise_pct": item.get("surprisePercent"),
            }
            for item in (data or [])[:4]
        ]
    except Exception:
        return []
