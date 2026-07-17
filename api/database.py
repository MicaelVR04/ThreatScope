"""Data access layer with Supabase as primary storage and SQLite fallback."""

import sqlite3
import os
import logging
from collections import defaultdict
from typing import Optional
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./threatscope.db")
DB_PATH = DATABASE_URL.replace("sqlite:///", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_ALERTS_TABLE = os.getenv("SUPABASE_ALERTS_TABLE", "alerts").strip() or "alerts"
SUPABASE_ACTIVE = False


def _use_supabase() -> bool:
    return SUPABASE_ACTIVE


def _get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


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
    global SUPABASE_ACTIVE
    SUPABASE_ACTIVE = False
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            _get_supabase().table(SUPABASE_ALERTS_TABLE).select("id", count="exact").limit(1).execute()
            SUPABASE_ACTIVE = True
            logger.info("Supabase connection verified successfully.")
            return
        except Exception as e:
            logger.warning(f"Supabase init failed ({e}), falling back to SQLite.")

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
                timestamp TEXT NOT NULL,
                user_id   TEXT
            )
        """)
        # Existing local development databases predate user ownership. SQLite
        # cannot add the column in CREATE TABLE IF NOT EXISTS, so migrate them
        # in place as well.
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(alerts)")}
        if "user_id" not in columns:
            cursor.execute("ALTER TABLE alerts ADD COLUMN user_id TEXT")
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
    if _use_supabase():
        try:
            # Keep user_id from the verified JWT; only the server-generated
            # local id must be omitted before a Supabase insert.
            supabase_alert = {key: value for key, value in alert.items() if key != "id"}
            response = _get_supabase().table(SUPABASE_ALERTS_TABLE).insert(supabase_alert).execute()
            alert_id = response.data[0]["id"]
            logger.info(f"Supabase alert inserted with ID {alert_id}")
            return alert_id
        except Exception as e:
            logger.error(f"Supabase insert_alert failed: {e}")
            raise

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (type, src_ip, dst_ip, severity, message, timestamp, user_id)
            VALUES (:type, :src_ip, :dst_ip, :severity, :message, :timestamp, :user_id)
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
    if _use_supabase():
        try:
            query = _get_supabase().table(SUPABASE_ALERTS_TABLE).select("*").order("timestamp", desc=True)
            if severity:
                query = query.eq("severity", severity)
            return query.range(offset, offset + limit - 1).execute().data
        except Exception as e:
            logger.error(f"Supabase get_alerts failed: {e}")
            raise

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
    if _use_supabase():
        alerts = get_alerts(limit=10000, offset=0)
        summary = {"total": len(alerts), "high": 0, "medium": 0, "low": 0}
        for alert in alerts:
            severity = alert["severity"].lower()
            if severity in summary:
                summary[severity] += 1
        return summary

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


def get_stats(group_by: Optional[str] = None):
    """
    Returns alert counts grouped by attack type.
    Used for dashboard charts.

    Returns:
        list: [{ type, count }]
    """
    if _use_supabase():
        alerts = get_alerts(limit=10000, offset=0)
        grouped = defaultdict(int)
        for alert in alerts:
            grouped[alert["type"]] += 1
        return [
            {"type": alert_type, "count": count}
            for alert_type, count in sorted(grouped.items(), key=lambda item: item[1], reverse=True)
        ]

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
    if _use_supabase():
        try:
            _get_supabase().table(SUPABASE_ALERTS_TABLE).delete().neq("id", 0).execute()
            logger.info("All alerts cleared from Supabase.")
            return
        except Exception as e:
            logger.error(f"Supabase clear_alerts failed: {e}")
            raise

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
