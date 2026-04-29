import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from urllib.parse import quote


def fetch_stock_news(ticker: str, limit: int = 15) -> list:
    articles = _fetch_finnhub_news(ticker, limit)
    if not articles:
        articles = _fetch_google_news(ticker, limit)
    if not articles:
        articles = _fetch_yahoo_rss(ticker, limit)
    return articles[:limit]


def _fetch_finnhub_news(ticker: str, limit: int) -> list:
    key = os.environ.get("FINNHUB_API_KEY", "")
    if not key:
        return []
    try:
        today = datetime.utcnow().date()
        from_date = (today - timedelta(days=30)).isoformat()
        to_date = today.isoformat()
        r = requests.get(
            "https://finnhub.io/api/v1/company-news",
            params={"symbol": ticker, "from": from_date, "to": to_date, "token": key},
            headers={"User-Agent": "QuantAnalyzer/1.0"},
            timeout=10,
        )
        r.raise_for_status()
        articles = []
        for item in r.json()[:limit]:
            ts = item.get("datetime", 0)
            try:
                published = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
            except Exception:
                published = ""
            text = (item.get("headline") or "") + " " + (item.get("summary") or "")
            articles.append({
                "title":     item.get("headline", ""),
                "summary":   item.get("summary", ""),
                "url":       item.get("url", ""),
                "source":    item.get("source", ""),
                "published": published,
                "image":     item.get("image", ""),
                "sentiment": _basic_sentiment(text),
            })
        return articles
    except Exception:
        return []


def _fetch_google_news(ticker: str, limit: int) -> list:
    query = quote(f"{ticker} stock")
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return []
        articles = []
        for item in channel.findall("item")[:limit]:
            title    = item.findtext("title", "")
            link     = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source   = item.findtext("source") or ""
            try:
                parsed = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d %H:%M")
            except Exception:
                parsed = pub_date[:16] if pub_date else ""
            articles.append({
                "title": title, "summary": "", "url": link,
                "source": source, "published": parsed, "image": "",
                "sentiment": _basic_sentiment(title),
            })
        return articles
    except Exception:
        return []


def _fetch_yahoo_rss(ticker: str, limit: int) -> list:
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return []
        articles = []
        for item in channel.findall("item")[:limit]:
            title    = item.findtext("title", "")
            link     = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            desc     = item.findtext("description", "")
            try:
                parsed = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z").strftime("%Y-%m-%d %H:%M")
            except Exception:
                parsed = pub_date[:16] if pub_date else ""
            articles.append({
                "title": title, "summary": desc, "url": link,
                "source": "Yahoo Finance", "published": parsed, "image": "",
                "sentiment": _basic_sentiment(title + " " + desc),
            })
        return articles
    except Exception:
        return []


def _basic_sentiment(text: str) -> str:
    t = text.lower()
    bull = sum(1 for w in [
        "surge", "soar", "rally", "beat", "record", "growth", "profit", "gain",
        "upgrade", "outperform", "buy", "strong", "positive", "rise", "boost",
        "bullish", "opportunity", "exceed", "optimistic", "recovery", "breakout",
        "momentum", "high", "above", "better", "approve",
    ] if w in t)
    bear = sum(1 for w in [
        "fall", "drop", "decline", "miss", "loss", "weak", "downgrade", "sell",
        "underperform", "bearish", "risk", "concern", "warning", "cut", "lower",
        "poor", "disappointing", "recession", "crash", "plunge", "tumble", "below",
        "worse", "layoff", "bankrupt", "sue", "investigation", "fine", "debt",
    ] if w in t)
    return "bullish" if bull > bear else "bearish" if bear > bull else "neutral"
