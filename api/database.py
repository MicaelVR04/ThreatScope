"""
database.py — data access layer for ThreatScope

Primary mode:
- Supabase Postgres via the official Python client

Fallback mode:
- local SQLite when Supabase env vars are not configured
"""

import logging
import os
import sqlite3
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


def _use_supabase() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Initializes the configured backing store.
    Tries Supabase first, falls back to SQLite on failure.
    """
    if _use_supabase():
        try:
            client = _get_supabase()
            client.table(SUPABASE_ALERTS_TABLE).select("id", count="exact").limit(1).execute()
            logger.info("Supabase connection verified successfully.")
            return
        except Exception as e:
            logger.warning(f"Supabase init failed ({e}), falling back to SQLite.")

    conn = None
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
        logger.info("SQLite database initialized successfully.")
    except sqlite3.Error as e:
        logger.error(f"init_db failed: {e}")
        raise
    finally:
        if conn:
            conn.close()


def insert_alert(alert: dict):
    """
    Inserts a new alert and returns its id.
    """
    if _use_supabase():
        try:
            client = _get_supabase()
            supabase_alert = {k: v for k, v in alert.items() if k != "id"}
            response = client.table(SUPABASE_ALERTS_TABLE).insert(supabase_alert).execute()
            row = response.data[0]
            logger.info(f"Supabase alert inserted with ID {row['id']}")
            return row["id"]
        except Exception as e:
            logger.error(f"insert_alert failed: {e}")
            raise

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (type, src_ip, dst_ip, severity, message, timestamp)
            VALUES (:type, :src_ip, :dst_ip, :severity, :message, :timestamp)
        """, alert)
        alert_id = cursor.lastrowid
        conn.commit()
        logger.info(f"SQLite alert inserted with ID {alert_id}")
        return alert_id
    except sqlite3.Error as e:
        logger.error(f"insert_alert failed: {e}")
        raise
    finally:
        if conn:
            conn.close()


def get_alerts(severity: str = None, limit: int = 50, offset: int = 0):
    """
    Fetches alerts with optional severity filter and pagination.
    """
    if _use_supabase():
        try:
            client = _get_supabase()
            query = client.table(SUPABASE_ALERTS_TABLE).select("*").order("timestamp", desc=True)
            if severity:
                query = query.eq("severity", severity)
            upper = offset + limit - 1
            response = query.range(offset, upper).execute()
            return response.data
        except Exception as e:
            logger.error(f"get_alerts failed: {e}")
            raise

    conn = None
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
        if conn:
            conn.close()


def get_summary():
    """
    Returns a count of alerts grouped by severity.
    """
    alerts = get_alerts(limit=10000, offset=0)
    summary = {"total": len(alerts), "high": 0, "medium": 0, "low": 0}
    for alert in alerts:
        severity = alert["severity"]
        if severity == "HIGH":
            summary["high"] += 1
        elif severity == "MEDIUM":
            summary["medium"] += 1
        elif severity == "LOW":
            summary["low"] += 1
    return summary


def get_stats(group_by: Optional[str] = None):
    """
    Returns chart-ready stats for the dashboard.
    """
    alerts = list(reversed(get_alerts(limit=10000, offset=0)))

    if group_by == "type":
        grouped = defaultdict(lambda: {"count": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0})
        for alert in alerts:
            bucket = grouped[alert["type"]]
            bucket["count"] += 1
            if alert["severity"] in bucket:
                bucket[alert["severity"]] += 1
        return [
            {"type": alert_type, **values}
            for alert_type, values in sorted(grouped.items(), key=lambda item: item[1]["count"], reverse=True)
        ]

    buckets = {}
    for alert in alerts:
        bucket = alert["timestamp"][:16]
        if bucket not in buckets:
            buckets[bucket] = {
                "timestamp": bucket,
                "HIGH": 0,
                "MEDIUM": 0,
                "LOW": 0,
            }
        severity = alert["severity"]
        if severity in buckets[bucket]:
            buckets[bucket][severity] += 1

    return list(buckets.values())


def clear_alerts():
    """
    Deletes all alerts from the backing store.
    """
    if _use_supabase():
        try:
            client = _get_supabase()
            client.table(SUPABASE_ALERTS_TABLE).delete().neq("id", 0).execute()
            logger.info("All alerts cleared from Supabase.")
            return
        except Exception as e:
            logger.error(f"clear_alerts failed: {e}")
            raise

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM alerts")
        conn.commit()
        logger.info("All alerts cleared from SQLite.")
    except sqlite3.Error as e:
        logger.error(f"clear_alerts failed: {e}")
        raise
    finally:
        if conn:
            conn.close()
