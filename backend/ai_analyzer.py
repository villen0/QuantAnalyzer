import os
import json
from groq import Groq
from typing import Optional


def build_analysis_prompt(ticker: str, info: dict, indicators: dict, news: list, chart_data: list) -> str:
    # Safe formatters for potentially-None info values
    def n(v, decimals=2):
        return f"{v:.{decimals}f}" if v is not None else "N/A"
    def m(v):
        if v is None: return "N/A"
        if abs(v) >= 1e12: return f"${v/1e12:.2f}T"
        if abs(v) >= 1e9:  return f"${v/1e9:.2f}B"
        if abs(v) >= 1e6:  return f"${v/1e6:.2f}M"
        return f"${v:,.0f}"
    def pct(v):
        return f"{(v or 0)*100:.1f}%" if v is not None else "N/A"
    recent_prices = chart_data[-10:] if len(chart_data) >= 10 else chart_data
    price_summary = ", ".join([f"{d['date'][:10]}: ${d['close']}" for d in recent_prices])

    news_summary = ""
    if news:
        for n in news[:8]:
            news_summary += f"  - [{n['sentiment'].upper()}] {n['title']} ({n['source']}, {n['published'][:10]})\n"
    else:
        news_summary = "  No recent news available.\n"

    sr = indicators.get("support_resistance", {})
    fib = indicators.get("fibonacci", {})
    rsi = indicators.get("rsi")
    macd = indicators.get("macd")
    macd_signal = indicators.get("macd_signal")
    macd_hist = indicators.get("macd_histogram")
    stoch_k = indicators.get("stoch_k")
    bb_pos = indicators.get("bb_position")
    volume_ratio = indicators.get("volume_ratio")
    atr = indicators.get("atr")
    current_price = indicators.get("current_price")

    prompt = f"""You are a senior quantitative trader at Citadel who combines elite technical analysis with multi-framework institutional investment research to make precise BUY / SELL / HOLD calls.

Analyze {ticker} ({info.get('name', ticker)}) and produce a comprehensive trading decision.

═══════════════════════════════════════
COMPANY OVERVIEW
═══════════════════════════════════════
Sector: {info.get('sector', 'N/A')} | Industry: {info.get('industry', 'N/A')}
Market Cap: {m(info.get('market_cap'))} | Beta: {info.get('beta') or 'N/A'}
Current Price: ${current_price} | 52W High: {info.get('52w_high') or 'N/A'} | 52W Low: {info.get('52w_low') or 'N/A'}
P/E: {info.get('pe_ratio') or 'N/A'} | Forward P/E: {info.get('forward_pe') or 'N/A'} | P/B: {info.get('pb_ratio') or 'N/A'}
EPS (TTM): {info.get('eps') or 'N/A'} | Revenue: {m(info.get('revenue'))}
Gross Margin: {pct(info.get('gross_margins'))} | Op Margin: {pct(info.get('operating_margins'))} | Net Margin: {pct(info.get('profit_margins'))}
Debt/Equity: {info.get('debt_to_equity') or 'N/A'} | Free Cash Flow: {m(info.get('free_cashflow'))}
Analyst Target: {info.get('target_mean_price') or 'N/A'} | Analyst Consensus: {(info.get('recommendation') or 'N/A').upper()}
Short Ratio: {info.get('short_ratio') or 'N/A'} | Short % Float: {pct(info.get('short_percent_of_float'))}

═══════════════════════════════════════
TECHNICAL INDICATORS (Citadel Framework)
═══════════════════════════════════════
RSI(14): {rsi} {"→ OVERSOLD (<30)" if rsi and rsi < 30 else "→ OVERBOUGHT (>70)" if rsi and rsi > 70 else "→ Neutral zone"}
MACD Line: {macd} | Signal: {macd_signal} | Histogram: {macd_hist} {"→ BULLISH crossover" if macd and macd_signal and macd > macd_signal else "→ BEARISH crossover" if macd and macd_signal and macd < macd_signal else ""}
Stochastic K: {stoch_k} {"→ Oversold" if stoch_k and stoch_k < 20 else "→ Overbought" if stoch_k and stoch_k > 80 else ""}
BB Position: {f'{bb_pos:.2%}' if bb_pos else 'N/A'} (0=lower band, 1=upper band, 0.5=midband)
ATR(14): {atr} (volatility measure)

Moving Averages:
  EMA9: ${indicators.get('ema9', 'N/A')} | EMA21: ${indicators.get('ema21', 'N/A')}
  SMA20: ${indicators.get('sma20', 'N/A')} | SMA50: ${indicators.get('sma50', 'N/A')}
  SMA100: ${indicators.get('sma100', 'N/A')} | SMA200: ${indicators.get('sma200', 'N/A')}
  Price vs SMA50: {"ABOVE ✓" if indicators.get('price_above_sma50') else "BELOW ✗"}
  Price vs SMA200: {"ABOVE ✓" if indicators.get('price_above_sma200') else "BELOW ✗"}
  {"⚡ GOLDEN CROSS (50/200) detected!" if indicators.get('golden_cross_50_200') else ""}
  {"💀 DEATH CROSS (50/200) detected!" if indicators.get('death_cross_50_200') else ""}

Support & Resistance (Pivot Points):
  Resistance 2: ${sr.get('r2', 'N/A')} | Resistance 1: ${sr.get('r1', 'N/A')}
  Pivot: ${sr.get('pivot', 'N/A')}
  Support 1: ${sr.get('s1', 'N/A')} | Support 2: ${sr.get('s2', 'N/A')}
  Range Support: ${sr.get('support', 'N/A')} | Range Resistance: ${sr.get('resistance', 'N/A')}

Fibonacci Retracement Levels (last 50 bars):
  1.0 (High): ${fib.get('1.0', 'N/A')} | 0.786: ${fib.get('0.786', 'N/A')}
  0.618 (Golden): ${fib.get('0.618', 'N/A')} | 0.5: ${fib.get('0.5', 'N/A')}
  0.382: ${fib.get('0.382', 'N/A')} | 0.236: ${fib.get('0.236', 'N/A')}
  0.0 (Low): ${fib.get('0.0', 'N/A')}

Volume:
  Current Volume: {(indicators.get('volume') or 0):,} | 20-day Avg: {(indicators.get('avg_volume_20') or 0):,}
  Volume Ratio: {f'{volume_ratio:.2f}x' if volume_ratio else 'N/A'} {"→ HIGH volume (confirms move)" if volume_ratio and volume_ratio > 1.5 else "→ Low volume (weak conviction)" if volume_ratio and volume_ratio < 0.7 else "→ Normal volume"}

Recent Price History (last 10 bars):
{price_summary}

═══════════════════════════════════════
NEWS SENTIMENT (Renaissance Tech Framework)
═══════════════════════════════════════
Recent Headlines:
{news_summary}

═══════════════════════════════════════
REQUIRED ANALYSIS OUTPUT
═══════════════════════════════════════
Provide your analysis in the following exact JSON structure:

{{
  "decision": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": <integer 0-100>,
  "entry_price": <float or null>,
  "stop_loss": <float or null>,
  "profit_target": <float or null>,
  "risk_reward_ratio": <float or null>,
  "time_horizon": "short-term (days)" | "medium-term (weeks)" | "long-term (months)",
  "trend": {{
    "daily": "bullish" | "bearish" | "neutral",
    "weekly": "bullish" | "bearish" | "neutral",
    "overall": "bullish" | "bearish" | "neutral"
  }},
  "technical_summary": "<2-3 sentence plain-English summary of all technical signals>",
  "fundamental_summary": "<2-3 sentence plain-English summary of valuation and fundamentals>",
  "risk_factors": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "catalysts": ["<catalyst 1>", "<catalyst 2>"],
  "news_sentiment": "bullish" | "bearish" | "neutral" | "mixed",
  "key_levels": {{
    "must_hold": <float - key support level>,
    "breakout_target": <float - key resistance to break>
  }},
  "reasoning": "<3-5 sentences explaining the overall decision with specific reference to indicators, valuation, and news>"
}}

Be precise with price levels. Reference specific indicator values. Make a definitive call - do not be vague. Output ONLY valid JSON, no extra text."""
    return prompt


def analyze_stock(ticker: str, info: dict, indicators: dict, news: list, chart_data: list, api_key: Optional[str] = None) -> dict:
    key = api_key or os.environ.get("GROQ_API_KEY", "")
    if not key:
        return _fallback_analysis(ticker, indicators, info)

    client = Groq(api_key=key)
    prompt = build_analysis_prompt(ticker, info, indicators, news, chart_data)

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2048,
            messages=[
                {"role": "system", "content": "You are an elite quantitative analyst. Always respond with valid JSON only. No markdown, no extra text."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = completion.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        result["source"] = "groq-llama-3.3-70b"
        result["ticker"] = ticker.upper()
        return result
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "raw": raw, "ticker": ticker.upper()}
    except Exception as e:
        return {"error": str(e), "ticker": ticker.upper()}


def _fallback_analysis(ticker: str, indicators: dict, info: dict) -> dict:
    """Rule-based fallback when no API key is provided."""
    score = 0
    rsi = indicators.get("rsi")
    macd = indicators.get("macd")
    macd_signal = indicators.get("macd_signal")
    price_above_sma50 = indicators.get("price_above_sma50")
    price_above_sma200 = indicators.get("price_above_sma200")
    volume_ratio = indicators.get("volume_ratio")
    stoch_k = indicators.get("stoch_k")
    bb_pos = indicators.get("bb_position")

    if rsi:
        if rsi < 30:
            score += 2
        elif rsi < 40:
            score += 1
        elif rsi > 70:
            score -= 2
        elif rsi > 60:
            score -= 1

    if macd and macd_signal:
        score += 1 if macd > macd_signal else -1

    if price_above_sma50:
        score += 1
    elif price_above_sma50 is False:
        score -= 1

    if price_above_sma200:
        score += 1
    elif price_above_sma200 is False:
        score -= 1

    if volume_ratio and volume_ratio > 1.5:
        score += 1 if score > 0 else -1

    if indicators.get("golden_cross_50_200"):
        score += 2
    if indicators.get("death_cross_50_200"):
        score -= 2

    if score >= 4:
        decision = "STRONG BUY"
        confidence = 80
    elif score >= 2:
        decision = "BUY"
        confidence = 65
    elif score <= -4:
        decision = "STRONG SELL"
        confidence = 80
    elif score <= -2:
        decision = "SELL"
        confidence = 65
    else:
        decision = "HOLD"
        confidence = 55

    sr = indicators.get("support_resistance", {})
    price = indicators.get("current_price", 0)
    atr = indicators.get("atr") or 0

    return {
        "ticker": ticker.upper(),
        "decision": decision,
        "confidence": confidence,
        "entry_price": round(price, 2),
        "stop_loss": round(price - 2 * atr, 2) if atr else None,
        "profit_target": round(price + 3 * atr, 2) if atr else None,
        "risk_reward_ratio": 1.5,
        "time_horizon": "medium-term (weeks)",
        "trend": {
            "daily": "bullish" if score > 0 else "bearish" if score < 0 else "neutral",
            "weekly": "bullish" if price_above_sma50 else "bearish",
            "overall": "bullish" if price_above_sma200 else "bearish",
        },
        "technical_summary": f"Rule-based analysis: RSI at {f'{rsi:.1f}' if rsi else 'N/A'}, MACD {'above' if macd and macd_signal and macd > macd_signal else 'below'} signal. Price is {'above' if price_above_sma200 else 'below'} SMA200.",
        "fundamental_summary": f"P/E: {info.get('pe_ratio') or 'N/A'}, Market Cap: {('${:,.0f}'.format(info['market_cap'])) if info.get('market_cap') else 'N/A'}. Add GROQ_API_KEY for full AI analysis.",
        "risk_factors": ["No API key — analysis is rule-based only", "Verify with full Groq AI analysis"],
        "catalysts": ["Technical setup based on indicators"],
        "news_sentiment": "neutral",
        "key_levels": {
            "must_hold": sr.get("s1") or sr.get("support"),
            "breakout_target": sr.get("r1") or sr.get("resistance"),
        },
        "reasoning": f"Score-based decision ({score} points). Set GROQ_API_KEY environment variable for comprehensive AI analysis using Citadel, Morgan Stanley, Bridgewater, and Renaissance frameworks.",
        "source": "rule-based-fallback",
    }
