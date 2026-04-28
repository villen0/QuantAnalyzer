"""
Realistic mock data generator for demo mode.
Used when live market data is unavailable (sandboxed environments).
"""
import random
import math
from datetime import datetime, timedelta
from typing import Optional

# Realistic stock profiles
STOCK_PROFILES = {
    "AAPL": {"name": "Apple Inc.", "base_price": 178.5, "volatility": 0.015, "trend": 0.0003, "sector": "Technology", "industry": "Consumer Electronics", "beta": 1.28, "pe": 28.4, "market_cap": 2.8e12, "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide."},
    "TSLA": {"name": "Tesla, Inc.", "base_price": 248.0, "volatility": 0.035, "trend": 0.0001, "sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "beta": 2.31, "pe": 65.2, "market_cap": 7.9e11, "description": "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, energy generation and storage systems, and related services."},
    "NVDA": {"name": "NVIDIA Corporation", "base_price": 875.0, "volatility": 0.028, "trend": 0.0008, "sector": "Technology", "industry": "Semiconductors", "beta": 1.72, "pe": 72.1, "market_cap": 2.15e12, "description": "NVIDIA Corporation provides graphics, compute and networking solutions in the United States, Taiwan, China, and internationally."},
    "MSFT": {"name": "Microsoft Corporation", "base_price": 415.0, "volatility": 0.012, "trend": 0.0004, "sector": "Technology", "industry": "Software - Infrastructure", "beta": 0.89, "pe": 35.6, "market_cap": 3.1e12, "description": "Microsoft Corporation develops and supports software, services, devices, and solutions worldwide."},
    "AMZN": {"name": "Amazon.com, Inc.", "base_price": 192.0, "volatility": 0.018, "trend": 0.0003, "sector": "Consumer Cyclical", "industry": "Internet Retail", "beta": 1.15, "pe": 45.8, "market_cap": 2.0e12, "description": "Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions through online and physical stores."},
    "GOOGL": {"name": "Alphabet Inc.", "base_price": 168.0, "volatility": 0.016, "trend": 0.0002, "sector": "Communication Services", "industry": "Internet Content & Information", "beta": 1.07, "pe": 24.3, "market_cap": 2.1e12, "description": "Alphabet Inc. provides various products and platforms in the United States, Europe, the Middle East, Africa, the Asia-Pacific, Canada, and Latin America."},
    "META": {"name": "Meta Platforms, Inc.", "base_price": 524.0, "volatility": 0.022, "trend": 0.0005, "sector": "Communication Services", "industry": "Internet Content & Information", "beta": 1.45, "pe": 26.8, "market_cap": 1.34e12, "description": "Meta Platforms, Inc. engages in the development of products that enable people to connect and share with friends and family."},
    "SPY":  {"name": "SPDR S&P 500 ETF Trust", "base_price": 512.0, "volatility": 0.008, "trend": 0.0002, "sector": "Financial", "industry": "Exchange Traded Fund", "beta": 1.0, "pe": 22.1, "market_cap": 5.5e11, "description": "The SPDR S&P 500 ETF Trust seeks to provide investment results that, before expenses, correspond generally to the price and yield performance of the S&P 500 Index."},
}

DEFAULT_PROFILE = {"name": "Unknown Corp", "base_price": 100.0, "volatility": 0.02, "trend": 0.0002, "sector": "N/A", "industry": "N/A", "beta": 1.0, "pe": 20.0, "market_cap": 1e9, "description": "No description available."}


def _generate_price_series(base_price: float, volatility: float, trend: float, days: int, seed: Optional[int] = None) -> list:
    """Generate realistic OHLCV price series with mean-reversion and momentum."""
    if seed is not None:
        random.seed(seed)

    prices = [base_price]
    volumes = []

    # Generate closing prices with Geometric Brownian Motion + mean reversion
    for i in range(1, days):
        # GBM with slight mean reversion
        drift = trend - 0.5 * volatility**2
        shock = random.gauss(0, volatility)
        # Add some momentum (autocorrelation)
        momentum = 0.1 * (prices[-1] - prices[max(0, len(prices)-5)]) / prices[-1] if len(prices) >= 5 else 0
        log_return = drift + shock + momentum * 0.1
        new_price = prices[-1] * math.exp(log_return)
        # Clamp to realistic bounds
        new_price = max(base_price * 0.4, min(base_price * 2.5, new_price))
        prices.append(new_price)

    # Generate OHLCV bars
    bars = []
    avg_volume = base_price * 5000000 / 100  # Scale volume by price

    for i, close in enumerate(prices):
        intraday_range = close * volatility * random.uniform(0.5, 2.0)
        open_price = close * (1 + random.gauss(0, volatility * 0.3))
        high = max(open_price, close) + intraday_range * random.uniform(0.1, 0.6)
        low = min(open_price, close) - intraday_range * random.uniform(0.1, 0.6)
        low = max(low, close * 0.85)

        # Volume: higher on big moves
        move_pct = abs(close - prices[i-1]) / prices[i-1] if i > 0 else 0
        vol_mult = 1 + move_pct * 15 + random.uniform(-0.3, 0.8)
        volume = int(avg_volume * vol_mult * random.uniform(0.4, 1.8))

        bars.append({
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": max(100000, volume),
        })

    return bars


def _period_to_days(period: str) -> int:
    mapping = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 252, "2y": 504}
    return mapping.get(period, 90)


def mock_ohlcv_for_chart(ticker: str, period: str = "3mo") -> list:
    profile = STOCK_PROFILES.get(ticker.upper(), DEFAULT_PROFILE)
    days = _period_to_days(period)
    # Use ticker as seed for consistent results per ticker
    seed = sum(ord(c) for c in ticker)
    bars = _generate_price_series(profile["base_price"], profile["volatility"], profile["trend"], days + 1, seed)

    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    result = []
    current = start_date
    bar_idx = 0
    while current <= end_date and bar_idx < len(bars):
        if current.weekday() < 5:  # Skip weekends
            result.append({
                "date": current.strftime("%Y-%m-%d %H:%M"),
                **bars[bar_idx],
            })
            bar_idx += 1
        current += timedelta(days=1)
    return result


def mock_stock_info(ticker: str) -> dict:
    profile = STOCK_PROFILES.get(ticker.upper(), {**DEFAULT_PROFILE, "name": f"{ticker.upper()} Corp"})
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
        "forward_pe": round(pe * 0.85, 1),
        "pb_ratio": round(pe * 0.12, 1),
        "ps_ratio": round(pe * 0.25, 1),
        "dividend_yield": 0.005 if pe < 25 else None,
        "beta": profile["beta"],
        "52w_high": round(price * 1.35, 2),
        "52w_low": round(price * 0.72, 2),
        "avg_volume": int(mcap / price / 40),
        "eps": round(price / pe, 2),
        "forward_eps": round(price / (pe * 0.85), 2),
        "revenue": round(mcap * 0.15),
        "gross_margins": 0.42,
        "operating_margins": 0.28,
        "profit_margins": 0.22,
        "debt_to_equity": 1.2,
        "free_cashflow": round(mcap * 0.04),
        "current_price": price,
        "target_mean_price": round(price * 1.18, 2),
        "recommendation": "buy",
        "num_analyst_opinions": 38,
        "short_ratio": 1.8,
        "short_percent_of_float": 0.025,
        "earnings_date": None,
        "description": profile["description"],
        "website": f"https://www.{ticker.lower()}.com",
        "country": "United States",
        "employees": int(mcap / 1e6),
    }


def mock_realtime_price(ticker: str) -> dict:
    profile = STOCK_PROFILES.get(ticker.upper(), DEFAULT_PROFILE)
    price = profile["base_price"]
    change = round(random.gauss(0, price * profile["volatility"]), 2)
    change_pct = round(change / price * 100, 2)
    return {
        "ticker": ticker.upper(),
        "price": round(price + change, 2),
        "prev_close": round(price, 2),
        "change": change,
        "change_pct": change_pct,
        "volume": int(profile["market_cap"] / price / 40 * random.uniform(0.6, 1.4)),
        "timestamp": datetime.utcnow().isoformat(),
    }


def mock_news(ticker: str) -> list:
    profile = STOCK_PROFILES.get(ticker.upper(), DEFAULT_PROFILE)
    name = profile["name"].split(" ")[0]
    sector = profile["sector"]
    price = profile["base_price"]

    templates = [
        (f"{name} Beats Q4 Earnings Estimates by 12%, Stock Surges", "bullish", "Reuters", f"{name} reported quarterly earnings that exceeded analyst expectations, driven by strong revenue growth across all business segments."),
        (f"Analysts Upgrade {name} to Overweight, Raise Price Target", "bullish", "Bloomberg", f"Wall Street analysts raised their price target for {ticker.upper()} citing improving fundamentals and strong market positioning."),
        (f"{name} Announces $10B Share Buyback Program", "bullish", "CNBC", f"{name} announced a significant share repurchase program, signaling management's confidence in the company's long-term value creation."),
        (f"{sector} Sector Faces Headwinds Amid Macro Concerns", "bearish", "Financial Times", f"Companies across the {sector} sector are navigating challenging macroeconomic conditions including elevated interest rates and slowing consumer demand."),
        (f"Fed Rate Decision Weighs on {sector} Stocks", "bearish", "MarketWatch", f"Federal Reserve's hawkish stance continues to pressure growth stocks in the {sector} sector as investors reassess valuations."),
        (f"{name} to Report Earnings Next Week — Street Expects Strong Results", "neutral", "Seeking Alpha", f"Analysts are broadly optimistic heading into {name}'s quarterly earnings report, with consensus EPS estimates pointing to year-over-year growth."),
        (f"{name} Expands into New Markets with Strategic Partnership", "bullish", "TechCrunch", f"{name} announced a strategic partnership that will accelerate its expansion into emerging markets, potentially adding significant revenue."),
        (f"Institutional Investors Increase Stakes in {ticker.upper()}", "bullish", "Barron's", f"Major institutional investors have been accumulating shares of {ticker.upper()}, with 13F filings showing increased positions from several top hedge funds."),
        (f"{name} Faces Regulatory Scrutiny Over Business Practices", "bearish", "Wall Street Journal", f"Regulators have launched an investigation into {name}'s business practices, creating uncertainty around the company's near-term outlook."),
        (f"Market Volatility Creates Buying Opportunity in {ticker.upper()}", "bullish", "Motley Fool", f"Recent market-wide selloff has brought {ticker.upper()} shares to attractive valuation levels, presenting a potential entry point for long-term investors."),
        (f"{name} CEO Outlines 5-Year Growth Strategy at Investor Day", "bullish", "Yahoo Finance", f"During its annual investor day, {name}'s management presented an ambitious growth roadmap targeting significant revenue expansion through 2028."),
        (f"Supply Chain Issues Could Impact {name} Margins", "bearish", "Reuters", f"Ongoing global supply chain disruptions are expected to weigh on {name}'s gross margins in the coming quarters, analysts warn."),
    ]

    random.seed(sum(ord(c) for c in ticker) + 42)
    selected = random.sample(templates, min(10, len(templates)))
    now = datetime.now()

    result = []
    for i, (title, sentiment, source, summary) in enumerate(selected):
        pub_date = now - timedelta(hours=random.randint(2, 72))
        result.append({
            "title": title,
            "summary": summary,
            "url": f"https://finance.example.com/{ticker.lower()}-news-{i+1}",
            "source": source,
            "published": pub_date.strftime("%Y-%m-%d %H:%M"),
            "image": "",
            "sentiment": sentiment,
        })

    return result


def mock_earnings(ticker: str) -> list:
    profile = STOCK_PROFILES.get(ticker.upper(), DEFAULT_PROFILE)
    eps_base = profile["base_price"] / profile["pe"]
    quarters = ["Q1 2025", "Q4 2024", "Q3 2024", "Q2 2024"]
    result = []
    for i, q in enumerate(quarters):
        estimate = round(eps_base * (1 + 0.05 * (3 - i)), 2)
        surprise = random.uniform(-0.05, 0.12)
        actual = round(estimate * (1 + surprise), 2)
        result.append({
            "quarter": q,
            "actual": actual,
            "estimate": estimate,
            "surprise_pct": round(surprise * 100, 1),
        })
    return result
