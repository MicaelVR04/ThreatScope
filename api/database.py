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
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./threatscope.db")
DB_PATH = DATABASE_URL.replace("sqlite:///", "")


def get_connection():
    """
    Returns a new SQLite connection.
    Called at the start of each database operation.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Creates the alerts table if it doesn't already exist.
    Called once when the API starts up.
    """
    try:
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
        logger.info("Database initialized successfully.")
    except sqlite3.Error as e:
        logger.error(f"init_db failed: {e}")
        raise
    finally:
        conn.close()


def insert_alert(alert: dict):
    """
    Inserts a new alert into the database.

    Args:
        alert (dict): Alert data from the engine

    Returns:
        int: The ID of the newly inserted alert
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (type, src_ip, dst_ip, severity, message, timestamp)
            VALUES (:type, :src_ip, :dst_ip, :severity, :message, :timestamp)
        """, alert)
        alert_id = cursor.lastrowid
        conn.commit()
        logger.info(f"Alert inserted with ID {alert_id}")
        return alert_id
    except sqlite3.Error as e:
        logger.error(f"insert_alert failed: {e}")
        raise
    finally:
        conn.close()


def get_alerts(severity: str = None, limit: int = 50, offset: int = 0):
    """
    Fetches alerts from the database with optional severity filter and pagination.

    Args:
        severity (str): Optional filter — "LOW", "MEDIUM", or "HIGH"
        limit (int): Max number of alerts to return (default 50)
        offset (int): Number of alerts to skip for pagination (default 0)

    Returns:
        list: List of alert dicts
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        if severity:
            cursor.execute("""
                SELECT * FROM alerts
                WHERE severity = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (severity, limit, offset))
        else:
            cursor.execute("""
                SELECT * FROM alerts
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))

        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        logger.error(f"get_alerts failed: {e}")
        raise
    finally:
        conn.close()


def get_summary():
    """
    Returns a count of alerts grouped by severity.

    Returns:
        dict: { total, high, medium, low }
    """
    try:
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

        return {"total": total, "high": high, "medium": medium, "low": low}
    except sqlite3.Error as e:
        logger.error(f"get_summary failed: {e}")
        raise
    finally:
        conn.close()


def get_stats():
    """
    Returns alert counts grouped by attack type.
    Used for dashboard charts.

    Returns:
        list: [{ type, count }]
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT type, COUNT(*) as count
            FROM alerts
            GROUP BY type
            ORDER BY count DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        logger.error(f"get_stats failed: {e}")
        raise
    finally:
        conn.close()


def clear_alerts():
    """
    Deletes all alerts from the database.
    Used for demo resets.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM alerts")
        conn.commit()
        logger.info("All alerts cleared from database.")
    except sqlite3.Error as e:
        logger.error(f"clear_alerts failed: {e}")
        raise
    finally:
        conn.close()
