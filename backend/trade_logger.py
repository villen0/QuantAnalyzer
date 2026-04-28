import sqlite3
import json
from datetime import datetime
from typing import Optional
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "trades.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            action TEXT NOT NULL,
            price REAL,
            shares REAL,
            total_value REAL,
            ai_decision TEXT,
            ai_confidence INTEGER,
            ai_reasoning TEXT,
            technical_summary TEXT,
            stop_loss REAL,
            profit_target REAL,
            risk_reward REAL,
            notes TEXT,
            timestamp TEXT NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS analysis_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            decision TEXT,
            confidence INTEGER,
            entry_price REAL,
            stop_loss REAL,
            profit_target REAL,
            full_analysis TEXT,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def log_trade(
    ticker: str,
    action: str,
    price: float,
    shares: float,
    ai_decision: str = "",
    ai_confidence: int = 0,
    ai_reasoning: str = "",
    technical_summary: str = "",
    stop_loss: Optional[float] = None,
    profit_target: Optional[float] = None,
    risk_reward: Optional[float] = None,
    notes: str = "",
) -> dict:
    init_db()
    total_value = price * shares if price and shares else 0
    timestamp = datetime.utcnow().isoformat()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO trades
        (ticker, action, price, shares, total_value, ai_decision, ai_confidence,
         ai_reasoning, technical_summary, stop_loss, profit_target, risk_reward, notes, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ticker.upper(), action.upper(), price, shares, total_value,
        ai_decision, ai_confidence, ai_reasoning, technical_summary,
        stop_loss, profit_target, risk_reward, notes, timestamp
    ))
    trade_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": trade_id, "ticker": ticker, "action": action, "timestamp": timestamp}


def log_analysis(ticker: str, analysis: dict):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO analysis_log
        (ticker, decision, confidence, entry_price, stop_loss, profit_target, full_analysis, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ticker.upper(),
        analysis.get("decision"),
        analysis.get("confidence"),
        analysis.get("entry_price"),
        analysis.get("stop_loss"),
        analysis.get("profit_target"),
        json.dumps(analysis),
        datetime.utcnow().isoformat(),
    ))
    conn.commit()
    conn.close()


def get_trades(ticker: Optional[str] = None, limit: int = 50) -> list:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    if ticker:
        c.execute("SELECT * FROM trades WHERE ticker = ? ORDER BY id DESC LIMIT ?", (ticker.upper(), limit))
    else:
        c.execute("SELECT * FROM trades ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_analysis_log(ticker: Optional[str] = None, limit: int = 20) -> list:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    if ticker:
        c.execute("SELECT * FROM analysis_log WHERE ticker = ? ORDER BY id DESC LIMIT ?", (ticker.upper(), limit))
    else:
        c.execute("SELECT * FROM analysis_log ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    result = []
    for r in rows:
        row = dict(r)
        if row.get("full_analysis"):
            try:
                row["full_analysis"] = json.loads(row["full_analysis"])
            except Exception:
                pass
        result.append(row)
    return result


def delete_trade(trade_id: int) -> bool:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM trades WHERE id = ?", (trade_id,))
    affected = c.rowcount
    conn.commit()
    conn.close()
    return affected > 0
