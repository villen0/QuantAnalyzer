import pandas as pd
import numpy as np


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def compute_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def compute_bollinger_bands(close: pd.Series, period: int = 20, std_dev: float = 2.0):
    sma = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    upper = sma + std_dev * std
    lower = sma - std_dev * std
    return upper, sma, lower


def compute_sma(close: pd.Series, period: int) -> pd.Series:
    return close.rolling(window=period).mean()


def compute_ema(close: pd.Series, period: int) -> pd.Series:
    return close.ewm(span=period, adjust=False).mean()


def compute_vwap(df: pd.DataFrame) -> pd.Series:
    typical_price = (df["High"] + df["Low"] + df["Close"]) / 3
    vwap = (typical_price * df["Volume"]).cumsum() / df["Volume"].cumsum()
    return vwap


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_low = df["High"] - df["Low"]
    high_close = (df["High"] - df["Close"].shift()).abs()
    low_close = (df["Low"] - df["Close"].shift()).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(window=period).mean()


def compute_stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    low_min = df["Low"].rolling(window=k_period).min()
    high_max = df["High"].rolling(window=k_period).max()
    k = 100 * (df["Close"] - low_min) / (high_max - low_min).replace(0, np.nan)
    d = k.rolling(window=d_period).mean()
    return k, d


def compute_fibonacci_levels(df: pd.DataFrame, lookback: int = 50):
    recent = df.tail(lookback)
    high = recent["High"].max()
    low = recent["Low"].min()
    diff = high - low
    levels = {
        "0.0": low,
        "0.236": low + 0.236 * diff,
        "0.382": low + 0.382 * diff,
        "0.5": low + 0.5 * diff,
        "0.618": low + 0.618 * diff,
        "0.786": low + 0.786 * diff,
        "1.0": high,
    }
    return levels


def compute_support_resistance(df: pd.DataFrame, lookback: int = 60):
    recent = df.tail(lookback)
    closes = recent["Close"]
    support = float(closes.min())
    resistance = float(closes.max())

    # Pivot points from recent high/low/close
    pivot = (recent["High"].iloc[-1] + recent["Low"].iloc[-1] + recent["Close"].iloc[-1]) / 3
    r1 = 2 * pivot - recent["Low"].iloc[-1]
    s1 = 2 * pivot - recent["High"].iloc[-1]
    r2 = pivot + (recent["High"].iloc[-1] - recent["Low"].iloc[-1])
    s2 = pivot - (recent["High"].iloc[-1] - recent["Low"].iloc[-1])

    return {
        "support": round(float(support), 2),
        "resistance": round(float(resistance), 2),
        "pivot": round(float(pivot), 2),
        "r1": round(float(r1), 2),
        "r2": round(float(r2), 2),
        "s1": round(float(s1), 2),
        "s2": round(float(s2), 2),
    }


def compute_smc(df: pd.DataFrame) -> dict:
    """Smart Money Concepts: market structure, order blocks, FVGs, liquidity, premium/discount."""
    highs  = df["High"]
    lows   = df["Low"]
    closes = df["Close"]
    opens  = df["Open"]
    current_price = float(closes.iloc[-1])

    # Swing highs / lows (5-bar pivot)
    window = 5
    sh_list, sl_list = [], []
    for i in range(window, len(df) - window):
        h = float(highs.iloc[i])
        if h == highs.iloc[i - window: i + window + 1].max():
            sh_list.append({"idx": i, "price": round(h, 2)})
        l = float(lows.iloc[i])
        if l == lows.iloc[i - window: i + window + 1].min():
            sl_list.append({"idx": i, "price": round(l, 2)})

    # Market structure (HH/HL = bullish, LH/LL = bearish)
    market_structure = "ranging"
    if len(sh_list) >= 2 and len(sl_list) >= 2:
        hh = sh_list[-1]["price"] > sh_list[-2]["price"]
        hl = sl_list[-1]["price"] > sl_list[-2]["price"]
        lh = sh_list[-1]["price"] < sh_list[-2]["price"]
        ll = sl_list[-1]["price"] < sl_list[-2]["price"]
        if hh and hl:
            market_structure = "bullish"
        elif lh and ll:
            market_structure = "bearish"

    # Break of Structure / Change of Character
    bos, choch = None, None
    if sh_list and sl_list:
        last_sh = sh_list[-1]["price"]
        last_sl = sl_list[-1]["price"]
        if current_price > last_sh:
            if market_structure == "bullish":
                bos   = {"direction": "bullish", "level": last_sh}
            else:
                choch = {"direction": "bullish", "level": last_sh, "description": "Bearish-to-Bullish shift"}
        elif current_price < last_sl:
            if market_structure == "bearish":
                bos   = {"direction": "bearish", "level": last_sl}
            else:
                choch = {"direction": "bearish", "level": last_sl, "description": "Bullish-to-Bearish shift"}

    # Order Blocks (last 60 bars)
    bullish_obs, bearish_obs = [], []
    start = max(0, len(df) - 60)
    for i in range(start, len(df) - 2):
        o = float(opens.iloc[i]);  c = float(closes.iloc[i])
        h = float(highs.iloc[i]);  l = float(lows.iloc[i])
        nxt = df.iloc[i + 1: i + 3]
        if len(nxt) < 2:
            continue
        # Bullish OB: bearish candle → 2 consecutive bullish candles with >0.8% move
        if c < o and all(nxt["Close"] > nxt["Open"]):
            move = (float(nxt["Close"].iloc[-1]) - l) / l
            if move > 0.008:
                bullish_obs.append({"high": round(h, 2), "low": round(l, 2), "mitigated": current_price < l})
        # Bearish OB: bullish candle → 2 consecutive bearish candles with >0.8% move
        if c > o and all(nxt["Close"] < nxt["Open"]):
            move = (h - float(nxt["Close"].iloc[-1])) / h
            if move > 0.008:
                bearish_obs.append({"high": round(h, 2), "low": round(l, 2), "mitigated": current_price > h})

    bullish_obs = bullish_obs[-3:][::-1]
    bearish_obs = bearish_obs[-3:][::-1]

    # Fair Value Gaps (3-candle imbalance)
    fvgs = []
    for i in range(2, len(df)):
        pp_h = float(highs.iloc[i - 2]);  pp_l = float(lows.iloc[i - 2])
        c_l  = float(lows.iloc[i]);       c_h  = float(highs.iloc[i])
        if pp_h < c_l:   # bullish FVG
            fvgs.append({"type": "bullish", "top": round(c_l, 2), "bottom": round(pp_h, 2),
                          "size": round(c_l - pp_h, 2), "mitigated": current_price <= c_l and current_price >= pp_h})
        if pp_l > c_h:   # bearish FVG
            fvgs.append({"type": "bearish", "top": round(pp_l, 2), "bottom": round(c_h, 2),
                          "size": round(pp_l - c_h, 2), "mitigated": current_price >= c_h and current_price <= pp_l})
    recent_fvgs = fvgs[-5:][::-1]

    # Liquidity pools — equal highs (sell-side) and equal lows (buy-side)
    tolerance = 0.003
    sell_side, buy_side = [], []
    for i in range(len(sh_list)):
        for j in range(i + 1, len(sh_list)):
            p1, p2 = sh_list[i]["price"], sh_list[j]["price"]
            if abs(p1 - p2) / p1 < tolerance:
                level = round((p1 + p2) / 2, 2)
                if level > current_price:
                    sell_side.append(level)
    for i in range(len(sl_list)):
        for j in range(i + 1, len(sl_list)):
            p1, p2 = sl_list[i]["price"], sl_list[j]["price"]
            if abs(p1 - p2) / p1 < tolerance:
                level = round((p1 + p2) / 2, 2)
                if level < current_price:
                    buy_side.append(level)
    sell_side = sorted(set(sell_side))[:3]
    buy_side  = sorted(set(buy_side), reverse=True)[:3]

    # Premium / Discount (50% of 50-bar range)
    recent    = df.tail(50)
    rng_high  = round(float(recent["High"].max()), 2)
    rng_low   = round(float(recent["Low"].min()),  2)
    equil     = round((rng_high + rng_low) / 2, 2)
    band      = (rng_high - rng_low) * 0.05
    pd_zone   = "premium" if current_price > equil + band else "discount" if current_price < equil - band else "equilibrium"

    return {
        "market_structure": market_structure,
        "bos":   bos,
        "choch": choch,
        "order_blocks": {"bullish": bullish_obs, "bearish": bearish_obs},
        "fair_value_gaps": recent_fvgs,
        "liquidity": {"sell_side": sell_side, "buy_side": buy_side},
        "premium_discount": {"zone": pd_zone, "equilibrium": equil, "range_high": rng_high, "range_low": rng_low},
        "swing_highs": [sh["price"] for sh in sh_list[-5:]],
        "swing_lows":  [sl["price"] for sl in sl_list[-5:]],
    }


def compute_all_indicators(df: pd.DataFrame) -> dict:
    close = df["Close"]
    volume = df["Volume"]

    rsi = compute_rsi(close)
    macd_line, signal_line, macd_hist = compute_macd(close)
    bb_upper, bb_mid, bb_lower = compute_bollinger_bands(close)
    sma20 = compute_sma(close, 20)
    sma50 = compute_sma(close, 50)
    sma100 = compute_sma(close, 100)
    sma200 = compute_sma(close, 200)
    ema9 = compute_ema(close, 9)
    ema21 = compute_ema(close, 21)
    atr = compute_atr(df)
    stoch_k, stoch_d = compute_stochastic(df)
    avg_volume = volume.rolling(20).mean()
    volume_ratio = volume / avg_volume.replace(0, np.nan)

    last = -1
    current_price = float(close.iloc[last])
    fib = compute_fibonacci_levels(df)
    sr = compute_support_resistance(df)

    def safe_float(series, idx=-1):
        val = series.iloc[idx]
        if pd.isna(val):
            return None
        return round(float(val), 4)

    # MA crossover signals — cast to Python bool to avoid numpy.bool_ serialization issues
    golden_cross_50_200 = bool(
        sma50.iloc[-1] > sma200.iloc[-1] and sma50.iloc[-2] <= sma200.iloc[-2]
        if len(df) > 2 else False
    )
    death_cross_50_200 = bool(
        sma50.iloc[-1] < sma200.iloc[-1] and sma50.iloc[-2] >= sma200.iloc[-2]
        if len(df) > 2 else False
    )

    sma200_val = safe_float(sma200)
    sma50_val = safe_float(sma50)
    price_above_sma200 = bool(current_price > sma200_val) if sma200_val is not None else None
    price_above_sma50 = bool(current_price > sma50_val) if sma50_val is not None else None

    bb_width = (bb_upper.iloc[last] - bb_lower.iloc[last]) / bb_mid.iloc[last] if not pd.isna(bb_mid.iloc[last]) else None
    bb_position = (current_price - bb_lower.iloc[last]) / (bb_upper.iloc[last] - bb_lower.iloc[last]) if not pd.isna(bb_lower.iloc[last]) else None

    return {
        "current_price": current_price,
        "rsi": safe_float(rsi),
        "macd": safe_float(macd_line),
        "macd_signal": safe_float(signal_line),
        "macd_histogram": safe_float(macd_hist),
        "bb_upper": safe_float(bb_upper),
        "bb_mid": safe_float(bb_mid),
        "bb_lower": safe_float(bb_lower),
        "bb_width": round(bb_width, 4) if bb_width else None,
        "bb_position": round(bb_position, 4) if bb_position else None,
        "sma20": safe_float(sma20),
        "sma50": safe_float(sma50),
        "sma100": safe_float(sma100),
        "sma200": safe_float(sma200),
        "ema9": safe_float(ema9),
        "ema21": safe_float(ema21),
        "atr": safe_float(atr),
        "stoch_k": safe_float(stoch_k),
        "stoch_d": safe_float(stoch_d),
        "volume": int(volume.iloc[last]),
        "avg_volume_20": int(avg_volume.iloc[last]) if not pd.isna(avg_volume.iloc[last]) else None,
        "volume_ratio": safe_float(volume_ratio),
        "price_above_sma200": price_above_sma200,
        "price_above_sma50": price_above_sma50,
        "golden_cross_50_200": golden_cross_50_200,
        "death_cross_50_200": death_cross_50_200,
        "fibonacci": {k: round(v, 2) for k, v in fib.items()},
        "support_resistance": sr,
        "smc": compute_smc(df),
    }
