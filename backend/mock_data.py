"""
Realistic mock data generator for demo mode.
Used when live market data is unavailable (sandboxed environments).
Generates convincing data for ANY ticker dynamically via hash-seeding.
"""
import random
import math
from datetime import datetime, timedelta
from typing import Optional

# Well-known stock profiles for accurate demo data
STOCK_PROFILES = {
    "AAPL": {"name": "Apple Inc.", "base_price": 212.0, "volatility": 0.015, "trend": 0.0003, "sector": "Technology", "industry": "Consumer Electronics", "beta": 1.28, "pe": 33.2, "market_cap": 3.2e12},
    "TSLA": {"name": "Tesla, Inc.", "base_price": 252.0, "volatility": 0.035, "trend": 0.0001, "sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "beta": 2.31, "pe": 55.8, "market_cap": 8.1e11},
    "NVDA": {"name": "NVIDIA Corporation", "base_price": 115.0, "volatility": 0.032, "trend": 0.0006, "sector": "Technology", "industry": "Semiconductors", "beta": 1.72, "pe": 38.5, "market_cap": 2.8e12},
    "MSFT": {"name": "Microsoft Corporation", "base_price": 388.0, "volatility": 0.012, "trend": 0.0004, "sector": "Technology", "industry": "Software - Infrastructure", "beta": 0.89, "pe": 32.4, "market_cap": 2.9e12},
    "AMZN": {"name": "Amazon.com, Inc.", "base_price": 205.0, "volatility": 0.018, "trend": 0.0003, "sector": "Consumer Cyclical", "industry": "Internet Retail", "beta": 1.15, "pe": 38.2, "market_cap": 2.2e12},
    "GOOGL": {"name": "Alphabet Inc.", "base_price": 162.0, "volatility": 0.016, "trend": 0.0002, "sector": "Communication Services", "industry": "Internet Content & Information", "beta": 1.07, "pe": 20.1, "market_cap": 2.0e12},
    "GOOG":  {"name": "Alphabet Inc. (Class C)", "base_price": 163.0, "volatility": 0.016, "trend": 0.0002, "sector": "Communication Services", "industry": "Internet Content & Information", "beta": 1.07, "pe": 20.1, "market_cap": 2.0e12},
    "META":  {"name": "Meta Platforms, Inc.", "base_price": 545.0, "volatility": 0.022, "trend": 0.0005, "sector": "Communication Services", "industry": "Internet Content & Information", "beta": 1.45, "pe": 24.5, "market_cap": 1.4e12},
    "SPY":   {"name": "SPDR S&P 500 ETF Trust", "base_price": 548.0, "volatility": 0.008, "trend": 0.0002, "sector": "Financial", "industry": "Exchange Traded Fund", "beta": 1.0, "pe": 22.8, "market_cap": 5.8e11},
    "QQQ":   {"name": "Invesco QQQ Trust", "base_price": 465.0, "volatility": 0.012, "trend": 0.0003, "sector": "Financial", "industry": "Exchange Traded Fund", "beta": 1.1, "pe": 32.0, "market_cap": 2.2e11},
    "BRK.B": {"name": "Berkshire Hathaway Inc.", "base_price": 455.0, "volatility": 0.010, "trend": 0.0002, "sector": "Financial", "industry": "Insurance - Diversified", "beta": 0.88, "pe": 24.1, "market_cap": 9.9e11},
    "JPM":   {"name": "JPMorgan Chase & Co.", "base_price": 240.0, "volatility": 0.014, "trend": 0.0002, "sector": "Financial", "industry": "Banks - Diversified", "beta": 1.11, "pe": 13.2, "market_cap": 6.9e11},
    "V":     {"name": "Visa Inc.", "base_price": 295.0, "volatility": 0.012, "trend": 0.0002, "sector": "Financial", "industry": "Credit Services", "beta": 0.96, "pe": 30.8, "market_cap": 6.0e11},
    "UNH":   {"name": "UnitedHealth Group Inc.", "base_price": 295.0, "volatility": 0.020, "trend": 0.0001, "sector": "Healthcare", "industry": "Healthcare Plans", "beta": 0.55, "pe": 14.5, "market_cap": 2.8e11},
    "JNJ":   {"name": "Johnson & Johnson", "base_price": 158.0, "volatility": 0.010, "trend": 0.0001, "sector": "Healthcare", "industry": "Drug Manufacturers", "beta": 0.54, "pe": 14.2, "market_cap": 3.8e11},
    "WMT":   {"name": "Walmart Inc.", "base_price": 95.0, "volatility": 0.010, "trend": 0.0002, "sector": "Consumer Defensive", "industry": "Discount Stores", "beta": 0.49, "pe": 38.5, "market_cap": 7.6e11},
    "XOM":   {"name": "Exxon Mobil Corporation", "base_price": 108.0, "volatility": 0.016, "trend": 0.0001, "sector": "Energy", "industry": "Oil & Gas Integrated", "beta": 1.08, "pe": 13.5, "market_cap": 4.6e11},
    "NFLX":  {"name": "Netflix, Inc.", "base_price": 985.0, "volatility": 0.025, "trend": 0.0004, "sector": "Communication Services", "industry": "Entertainment", "beta": 1.32, "pe": 52.1, "market_cap": 4.2e11},
    "AMD":   {"name": "Advanced Micro Devices", "base_price": 108.0, "volatility": 0.030, "trend": 0.0003, "sector": "Technology", "industry": "Semiconductors", "beta": 1.89, "pe": 32.4, "market_cap": 1.8e11},
    "INTC":  {"name": "Intel Corporation", "base_price": 20.0, "volatility": 0.025, "trend": -0.0002, "sector": "Technology", "industry": "Semiconductors", "beta": 1.05, "pe": None, "market_cap": 8.6e10},
    "DIS":   {"name": "The Walt Disney Company", "base_price": 88.0, "volatility": 0.018, "trend": 0.0001, "sector": "Communication Services", "industry": "Entertainment", "beta": 1.39, "pe": 28.5, "market_cap": 1.6e11},
    "PYPL":  {"name": "PayPal Holdings, Inc.", "base_price": 72.0, "volatility": 0.022, "trend": 0.0001, "sector": "Financial", "industry": "Credit Services", "beta": 1.62, "pe": 14.8, "market_cap": 7.8e10},
    "COIN":  {"name": "Coinbase Global, Inc.", "base_price": 195.0, "volatility": 0.055, "trend": 0.0003, "sector": "Financial", "industry": "Financial Data & Stock Exchanges", "beta": 3.1, "pe": 28.0, "market_cap": 4.8e10},
    "PLTR":  {"name": "Palantir Technologies", "base_price": 88.0, "volatility": 0.042, "trend": 0.0005, "sector": "Technology", "industry": "Software - Infrastructure", "beta": 2.45, "pe": 185.0, "market_cap": 2.0e11},
    "SOFI":  {"name": "SoFi Technologies, Inc.", "base_price": 14.0, "volatility": 0.040, "trend": 0.0002, "sector": "Financial", "industry": "Credit Services", "beta": 1.95, "pe": 38.0, "market_cap": 1.4e10},
    "RBLX":  {"name": "Roblox Corporation", "base_price": 38.0, "volatility": 0.038, "trend": 0.0001, "sector": "Communication Services", "industry": "Electronic Gaming & Multimedia", "beta": 1.85, "pe": None, "market_cap": 6.6e10},
}

# Sector pools for dynamic ticker generation
_SECTORS = [
    ("Technology", "Software - Application"),
    ("Technology", "Semiconductors"),
    ("Healthcare", "Biotechnology"),
    ("Financial", "Asset Management"),
    ("Consumer Cyclical", "Specialty Retail"),
    ("Energy", "Oil & Gas E&P"),
    ("Industrials", "Aerospace & Defense"),
    ("Communication Services", "Telecom Services"),
    ("Consumer Defensive", "Packaged Foods"),
    ("Real Estate", "REIT - Diversified"),
]


def _dynamic_profile(ticker: str) -> dict:
    """Generate a deterministic, realistic profile for any unknown ticker."""
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(ticker))
    rng = random.Random(seed)

    # Realistic price buckets based on ticker hash
    price_buckets = [5, 12, 25, 45, 75, 110, 160, 220, 310, 450, 680, 950, 1400, 2500]
    base_price = rng.choice(price_buckets) * (1 + rng.uniform(-0.15, 0.15))

    # Volatility scaled to price (cheaper stocks tend to be more volatile)
    volatility = 0.035 - 0.012 * math.log10(max(base_price, 5) / 5) / math.log10(500)
    volatility = max(0.008, min(0.06, volatility)) + rng.uniform(-0.005, 0.01)

    beta = round(rng.uniform(0.5, 2.8), 2)
    trend = rng.uniform(-0.0003, 0.0008)
    pe = round(rng.uniform(8, 80), 1) if rng.random() > 0.2 else None
    market_cap = base_price * rng.uniform(5e6, 5e9)

    sector, industry = rng.choice(_SECTORS)

    # Derive a plausible company name from the ticker
    syllables = ["Tech", "Corp", "Holdings", "Group", "Systems", "Labs",
                 "Capital", "Networks", "Solutions", "Dynamics", "Global", "Digital"]
    name = f"{ticker.upper()} {rng.choice(syllables)}, Inc."

    return {
        "name": name,
        "base_price": round(base_price, 2),
        "volatility": round(volatility, 4),
        "trend": round(trend, 5),
        "sector": sector,
        "industry": industry,
        "beta": beta,
        "pe": pe,
        "market_cap": round(market_cap),
    }


def _get_profile(ticker: str) -> dict:
    return STOCK_PROFILES.get(ticker.upper()) or _dynamic_profile(ticker)


def _generate_price_series(base_price: float, volatility: float, trend: float, days: int, seed: int) -> list:
    random.seed(seed)
    prices = [base_price]
    for i in range(1, days):
        drift = trend - 0.5 * volatility ** 2
        shock = random.gauss(0, volatility)
        momentum = 0.1 * (prices[-1] - prices[max(0, len(prices) - 5)]) / prices[-1] if len(prices) >= 5 else 0
        log_return = drift + shock + momentum * 0.1
        new_price = prices[-1] * math.exp(log_return)
        new_price = max(base_price * 0.3, min(base_price * 3.0, new_price))
        prices.append(new_price)
    return prices


def _period_to_days(period: str) -> int:
    return {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 252, "2y": 504}.get(period, 90)


def mock_ohlcv_for_chart(ticker: str, period: str = "3mo") -> list:
    profile = _get_profile(ticker)
    days = _period_to_days(period)
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(ticker))
    prices = _generate_price_series(profile["base_price"], profile["volatility"], profile["trend"], days + 1, seed)

    end_date = datetime.now()
    result = []
    current = end_date - timedelta(days=days)
    bar_idx = 0
    rng = random.Random(seed + 1)
    avg_volume = profile["market_cap"] / profile["base_price"] / 40

    while current <= end_date and bar_idx < len(prices):
        if current.weekday() < 5:
            close = prices[bar_idx]
            intraday = close * profile["volatility"] * rng.uniform(0.5, 2.0)
            open_p = close * (1 + rng.gauss(0, profile["volatility"] * 0.3))
            high = max(open_p, close) + intraday * rng.uniform(0.1, 0.6)
            low = min(open_p, close) - intraday * rng.uniform(0.1, 0.6)
            low = max(low, close * 0.85)
            move = abs(close - prices[max(0, bar_idx - 1)]) / prices[max(0, bar_idx - 1)] if bar_idx > 0 else 0
            volume = int(avg_volume * (1 + move * 15 + rng.uniform(-0.3, 0.8)) * rng.uniform(0.4, 1.8))
            result.append({
                "date": current.strftime("%Y-%m-%d %H:%M"),
                "open": round(open_p, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(close, 2),
                "volume": max(100000, volume),
            })
            bar_idx += 1
        current += timedelta(days=1)
    return result


def mock_stock_info(ticker: str) -> dict:
    profile = _get_profile(ticker)
    price = profile["base_price"]
    pe = profile["pe"]
    mcap = profile["market_cap"]

    return {
        "ticker": ticker.upper(),
        "name": profile["name"],
        "sector": profile["sector"],
        "industry": profile["industry"],
        "market_cap": mcap,
        "pe_ratio": pe,
        "forward_pe": round(pe * 0.85, 1) if pe else None,
        "pb_ratio": round(pe * 0.12, 1) if pe else None,
        "ps_ratio": round(pe * 0.25, 1) if pe else None,
        "dividend_yield": 0.005 if pe and pe < 25 else None,
        "beta": profile["beta"],
        "52w_high": round(price * 1.35, 2),
        "52w_low": round(price * 0.68, 2),
        "avg_volume": int(mcap / price / 40),
        "eps": round(price / pe, 2) if pe else None,
        "forward_eps": round(price / (pe * 0.85), 2) if pe else None,
        "revenue": round(mcap * 0.15),
        "gross_margins": 0.42,
        "operating_margins": 0.28,
        "profit_margins": 0.22,
        "debt_to_equity": 1.2,
        "free_cashflow": round(mcap * 0.04),
        "current_price": round(price, 2),
        "target_mean_price": round(price * 1.18, 2),
        "recommendation": "buy",
        "num_analyst_opinions": 28,
        "short_ratio": 1.8,
        "short_percent_of_float": 0.025,
        "earnings_date": None,
        "description": f"{profile['name']} operates in the {profile['industry']} industry within the {profile['sector']} sector.",
        "website": f"https://www.{ticker.lower()}.com",
        "country": "United States",
        "employees": int(mcap / 1e6),
    }


def mock_realtime_price(ticker: str) -> dict:
    profile = _get_profile(ticker)
    price = profile["base_price"]
    rng = random.Random(int(datetime.now().timestamp() / 60))  # changes every minute
    change = round(rng.gauss(0, price * profile["volatility"]), 2)
    return {
        "ticker": ticker.upper(),
        "price": round(price + change, 2),
        "prev_close": round(price, 2),
        "change": change,
        "change_pct": round(change / price * 100, 2),
        "volume": int(profile["market_cap"] / price / 40 * rng.uniform(0.6, 1.4)),
        "timestamp": datetime.utcnow().isoformat(),
    }


def mock_earnings(ticker: str) -> list:
    profile = _get_profile(ticker)
    pe = profile["pe"] or 20
    eps_base = profile["base_price"] / pe
    rng = random.Random(sum(ord(c) for c in ticker) + 99)
    quarters = ["Q1 2025", "Q4 2024", "Q3 2024", "Q2 2024"]
    result = []
    for i, q in enumerate(quarters):
        estimate = round(eps_base * (1 + 0.05 * (3 - i)), 2)
        surprise = rng.uniform(-0.08, 0.14)
        result.append({
            "quarter": q,
            "actual": round(estimate * (1 + surprise), 2),
            "estimate": estimate,
            "surprise_pct": round(surprise * 100, 1),
        })
    return result


def mock_news(ticker: str) -> list:
    profile = _get_profile(ticker)
    name = profile["name"].split(" ")[0]
    sector = profile["sector"]
    rng = random.Random(sum(ord(c) for c in ticker) + 42)

    templates = [
        (f"{name} Beats Q4 Earnings Estimates, Stock Surges", "bullish", "Reuters"),
        (f"Analysts Upgrade {name} to Overweight, Raise Price Target to New High", "bullish", "Bloomberg"),
        (f"{name} Announces Share Buyback Program Worth Billions", "bullish", "CNBC"),
        (f"{sector} Sector Faces Headwinds Amid Rising Interest Rates", "bearish", "Financial Times"),
        (f"Fed Rate Decision Weighs on {sector} Stocks", "bearish", "MarketWatch"),
        (f"{name} to Report Earnings — Street Expects Strong Results", "neutral", "Seeking Alpha"),
        (f"{name} Expands into New Markets with Strategic Partnership", "bullish", "TechCrunch"),
        (f"Institutional Investors Increase Stakes in {ticker.upper()}", "bullish", "Barron's"),
        (f"{name} Faces Regulatory Scrutiny Over Business Practices", "bearish", "Wall Street Journal"),
        (f"Market Selloff Creates Buying Opportunity in {ticker.upper()}", "bullish", "Motley Fool"),
        (f"{name} CEO Outlines 5-Year Growth Strategy at Investor Day", "bullish", "Yahoo Finance"),
        (f"Supply Chain Issues Could Impact {name} Margins in Coming Quarters", "bearish", "Reuters"),
    ]

    selected = rng.sample(templates, min(10, len(templates)))
    now = datetime.now()
    return [
        {
            "title": title,
            "summary": f"Latest developments surrounding {name} and its position in the {sector} sector.",
            "url": "",
            "source": source,
            "published": (now - timedelta(hours=rng.randint(2, 72))).strftime("%Y-%m-%d %H:%M"),
            "image": "",
            "sentiment": sentiment,
        }
        for title, sentiment, source in selected
    ]
