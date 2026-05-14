"""
database.py — SQLite database connection for ThreatScope
Person 2 owns this file.

Responsibilities:
- Create and manage the SQLite database connection
- Create the alerts table if it doesn't exist
- Provide functions to insert and query alerts
"""

import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./threatscope.db")

# Extract the file path from the URL
DB_PATH = DATABASE_URL.replace("sqlite:///", "")


def get_connection():
    """
    Returns a new SQLite connection.
    Called at the start of each database operation.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us access columns by name
    return conn


def init_db():
    """
    Creates the alerts table if it doesn't already exist.
    Called once when the API starts up.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            type      TEXT NOT NULL,
            src_ip    TEXT NOT NULL,
            dst_ip    TEXT NOT NULL,
            severity  TEXT NOT NULL,
            message   TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def insert_alert(alert: dict):
    """
    Inserts a new alert into the database.

    Args:
        alert (dict): Alert data from the engine

    Returns:
        int: The ID of the newly inserted alert
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO alerts (type, src_ip, dst_ip, severity, message, timestamp)
        VALUES (:type, :src_ip, :dst_ip, :severity, :message, :timestamp)
    """, alert)

    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return alert_id


def get_alerts(severity: str = None, limit: int = 100):
    """
    Fetches alerts from the database.

    Args:
        severity (str): Optional filter — "LOW", "MEDIUM", or "HIGH"
        limit (int): Max number of alerts to return (default 100)

    Returns:
        list: List of alert dicts
    """
    conn = get_connection()
    cursor = conn.cursor()

    if severity:
        cursor.execute("""
            SELECT * FROM alerts
            WHERE severity = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (severity, limit))
    else:
        cursor.execute("""
            SELECT * FROM alerts
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_summary():
    """
    Returns a count of alerts grouped by severity.
    Used for the dashboard summary cards.

    Returns:
        dict: { total, high, medium, low }
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM alerts")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM alerts WHERE severity = 'HIGH'")
    high = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM alerts WHERE severity = 'MEDIUM'")
    medium = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM alerts WHERE severity = 'LOW'")
    low = cursor.fetchone()[0]

    conn.close()

    return { "total": total, "high": high, "medium": medium, "low": low }
