import math
import numpy as np
import pandas as pd


# ── Indicators ────────────────────────────────────────────────────────────────

def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta    = close.diff()
    gain     = delta.clip(lower=0)
    loss     = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs       = avg_gain / avg_loss.replace(0, float("nan"))
    return 100 - (100 / (1 + rs))


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low  - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


# ── Back-test ─────────────────────────────────────────────────────────────────

def _run_backtest(
    df: pd.DataFrame,
    ma200: pd.Series,
    rsi_s: pd.Series,
    atr_s: pd.Series,
    account_size: float,
) -> dict:
    """
    Simulate the strategy bar-by-bar on historical data.
    Entry  : close of signal bar
    Exits  : SL (priority) → TP (2×R) → RSI returning to 50
    Sizing : 1% equity risk per trade
    """
    trades      = []
    in_trade    = False
    direction   = ""
    entry_price = sl = tp = 0.0
    equity      = account_size
    equity_curve = [account_size]
    peak_equity = account_size

    close_arr = df["Close"].values
    high_arr  = df["High"].values
    low_arr   = df["Low"].values
    ma_arr    = ma200.values
    rsi_arr   = rsi_s.values
    atr_arr   = atr_s.values
    n         = len(df)

    for i in range(200, n):
        if any(math.isnan(v) for v in (ma_arr[i], rsi_arr[i], atr_arr[i])):
            continue

        c, h, l, r = close_arr[i], high_arr[i], low_arr[i], rsi_arr[i]

        if in_trade:
            exit_price = None
            win        = False

            if direction == "long":
                if l <= sl:                    # stop loss (priority)
                    exit_price, win = sl, False
                elif h >= tp:                  # take profit
                    exit_price, win = tp, True
                elif r >= 50:                  # RSI back to neutral
                    exit_price, win = c, c > entry_price
            else:  # short
                if h >= sl:
                    exit_price, win = sl, False
                elif l <= tp:
                    exit_price, win = tp, True
                elif r <= 50:
                    exit_price, win = c, c < entry_price

            if exit_price is not None:
                sl_dist   = abs(entry_price - sl)
                pos_size  = (equity * 0.01) / sl_dist if sl_dist > 0 else 0
                raw_pnl   = (exit_price - entry_price) if direction == "long" else (entry_price - exit_price)
                dollar_pnl = raw_pnl * pos_size
                equity    += dollar_pnl
                peak_equity = max(peak_equity, equity)
                equity_curve.append(equity)
                trades.append({
                    "win":       win,
                    "pnl":       dollar_pnl,
                    "pnl_pct":   raw_pnl / entry_price,
                    "r_multiple": raw_pnl / sl_dist if sl_dist else 0,
                })
                in_trade = False

        if not in_trade:
            sl_dist = 1.5 * atr_arr[i]
            if sl_dist <= 0:
                continue
            if c > ma_arr[i] and r < 30:
                in_trade, direction = True, "long"
                entry_price = c
                sl = c - sl_dist
                tp = c + 2 * sl_dist
            elif c < ma_arr[i] and r > 70:
                in_trade, direction = True, "short"
                entry_price = c
                sl = c + sl_dist
                tp = c - 2 * sl_dist

    if not trades:
        return {
            "total_trades":     0,
            "win_rate":         None,
            "avg_win":          None,
            "avg_loss":         None,
            "profit_factor":    None,
            "sharpe":           None,
            "max_drawdown":     None,
            "total_return_pct": None,
        }

    wins   = [t["pnl"] for t in trades if t["win"]]
    losses = [t["pnl"] for t in trades if not t["win"]]
    pnl_pcts = [t["pnl_pct"] for t in trades]

    # Max drawdown from equity curve
    eq   = np.array(equity_curve)
    peak = np.maximum.accumulate(eq)
    max_dd = float(np.max((peak - eq) / peak)) * 100

    # Trade-based annualised Sharpe
    if len(pnl_pcts) > 1:
        mean_r = np.mean(pnl_pcts)
        std_r  = np.std(pnl_pcts, ddof=1)
        years  = len(df) / 252
        tpy    = len(trades) / years if years > 0 else len(trades)
        sharpe = (mean_r / std_r * math.sqrt(tpy)) if std_r > 0 else 0.0
    else:
        sharpe = 0.0

    pf = abs(sum(wins) / sum(losses)) if losses and sum(losses) != 0 else None

    return {
        "total_trades":     len(trades),
        "win_rate":         round(len(wins) / len(trades) * 100, 1),
        "avg_win":          round(sum(wins)   / len(wins),   2) if wins   else 0,
        "avg_loss":         round(sum(losses) / len(losses), 2) if losses else 0,
        "profit_factor":    round(pf, 2) if pf is not None else None,
        "sharpe":           round(sharpe, 2),
        "max_drawdown":     round(max_dd, 2),
        "total_return_pct": round((equity - account_size) / account_size * 100, 2),
    }


# ── Public entry-point ────────────────────────────────────────────────────────

def compute_quant_strategy(df: pd.DataFrame, account_size: float = 10000.0) -> dict:
    """
    Trend-following pullback strategy.
      Trend filter : 200-period SMA (long above, short below)
      Entry        : RSI(14) < 30 for longs, > 70 for shorts
      Stop loss    : 1.5 × ATR(14)
      Take profit  : 2 × risk (1:2 R:R)  OR  RSI returns to 50
      Position size: 1% account risk per trade
    Requires at least 215 daily bars.
    """
    if len(df) < 215:
        raise ValueError(
            f"Need at least 215 daily bars for MA200; got {len(df)}. "
            "Try a longer period (2y or 5y)."
        )

    close = df["Close"]
    high  = df["High"]
    low   = df["Low"]

    ma200 = close.rolling(200).mean()
    rsi_s = _rsi(close, 14)
    atr_s = _atr(high, low, close, 14)

    cur_close = float(close.iloc[-1])
    cur_ma200 = float(ma200.iloc[-1])
    cur_rsi   = float(rsi_s.iloc[-1])
    cur_atr   = float(atr_s.iloc[-1])

    above_ma  = cur_close > cur_ma200
    sl_dist   = 1.5 * cur_atr
    risk_amt  = account_size * 0.01
    pos_size  = risk_amt / sl_dist if sl_dist > 0 else 0

    rsi_zone = (
        "oversold"   if cur_rsi < 30 else
        "overbought" if cur_rsi > 70 else
        "neutral"
    )

    if above_ma and cur_rsi < 30:
        signal     = "BUY"
        entry      = cur_close
        stop_loss  = round(entry - sl_dist, 2)
        take_profit = round(entry + 2 * sl_dist, 2)
    elif not above_ma and cur_rsi > 70:
        signal      = "SELL"
        entry       = cur_close
        stop_loss   = round(entry + sl_dist, 2)
        take_profit = round(entry - 2 * sl_dist, 2)
    else:
        signal = "HOLD"
        entry = stop_loss = take_profit = None

    backtest = _run_backtest(df, ma200, rsi_s, atr_s, account_size)

    return {
        "signal":        signal,
        "entry":         round(entry, 2)       if entry       is not None else None,
        "stop_loss":     stop_loss,
        "take_profit":   take_profit,
        "rr_ratio":      2.0                   if signal != "HOLD" else None,
        "position_size": round(pos_size, 4),
        "position_size_shares": max(0, int(pos_size)),
        "risk_amount":   round(risk_amt, 2),
        "sl_distance":   round(sl_dist, 4),
        "account_size":  account_size,
        "indicators": {
            "price":  round(cur_close, 2),
            "ma200":  round(cur_ma200, 2) if not math.isnan(cur_ma200) else None,
            "rsi":    round(cur_rsi,   2),
            "atr":    round(cur_atr,   4),
            "trend":  "bullish" if above_ma else "bearish",
            "rsi_zone": rsi_zone,
        },
        "backtest": backtest,
    }
