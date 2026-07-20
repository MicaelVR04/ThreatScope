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
import json
from collections import defaultdict
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./threatscope.db")
DB_PATH = DATABASE_URL.replace("sqlite:///", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_ALERTS_TABLE = os.getenv("SUPABASE_ALERTS_TABLE", "alerts").strip() or "alerts"
SUPABASE_RUNTIME_STATE_TABLE = (
    os.getenv("SUPABASE_RUNTIME_STATE_TABLE", "runtime_state").strip()
    or "runtime_state"
)
SUPABASE_ACTIVE = False


def _use_supabase() -> bool:
    return SUPABASE_ACTIVE


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
    global SUPABASE_ACTIVE

    SUPABASE_ACTIVE = False
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            client = _get_supabase()
            client.table(SUPABASE_ALERTS_TABLE).select("id", count="exact").limit(1).execute()
            SUPABASE_ACTIVE = True
            logger.info("Supabase connection verified successfully.")
            return
        except Exception as e:
            if os.getenv("ALLOW_DATABASE_FALLBACK", "false").strip().lower() != "true":
                raise RuntimeError(
                    "Supabase is configured but unavailable; refusing to use ephemeral SQLite"
                ) from e
            logger.warning("Supabase init failed (%s), falling back to SQLite.", e)

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
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(alerts)")}
        if "user_id" not in columns:
            cursor.execute("ALTER TABLE alerts ADD COLUMN user_id TEXT")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS runtime_state (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        logger.info("SQLite database initialized successfully.")
    except sqlite3.Error as e:
        logger.error(f"init_db failed: {e}")
        raise
    finally:
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

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (type, src_ip, dst_ip, severity, message, timestamp, user_id)
            VALUES (:type, :src_ip, :dst_ip, :severity, :message, :timestamp, :user_id)
        """, alert)
        alert_id = cursor.lastrowid
        conn.commit()
        logger.info(f"SQLite alert inserted with ID {alert_id}")
        return alert_id
    except sqlite3.Error as e:
        logger.error(f"insert_alert failed: {e}")
        raise
    finally:
        conn.close()


def get_alerts(
    severity: str = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = None,
):
    """
    Fetches alerts with optional severity filter and pagination.
    """
    if _use_supabase():
        try:
            client = _get_supabase()
            query = client.table(SUPABASE_ALERTS_TABLE).select("*").order("timestamp", desc=True)
            if severity:
                query = query.eq("severity", severity)
            if user_id:
                query = query.eq("user_id", user_id)
            upper = offset + limit - 1
            response = query.range(offset, upper).execute()
            return response.data
        except Exception as e:
            logger.error(f"get_alerts failed: {e}")
            raise

    try:
        conn = get_connection()
        cursor = conn.cursor()
        if severity and user_id:
            cursor.execute("""
                SELECT * FROM alerts
                WHERE severity = ? AND user_id = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (severity, user_id, limit, offset))
        elif severity:
            cursor.execute("""
                SELECT * FROM alerts
                WHERE severity = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (severity, limit, offset))
        elif user_id:
            cursor.execute("""
                SELECT * FROM alerts
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (user_id, limit, offset))
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


def get_summary(user_id: str = None):
    """
    Returns a count of alerts grouped by severity.
    """
    alerts = get_alerts(limit=10000, offset=0, user_id=user_id)
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


def get_stats(group_by: Optional[str] = None, user_id: str = None):
    """
    Returns chart-ready stats for the dashboard.
    """
    alerts = list(reversed(get_alerts(limit=10000, offset=0, user_id=user_id)))

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


def clear_alerts(user_id: str = None):
    """
    Deletes alerts from the backing store, optionally scoped to one user.
    """
    if _use_supabase():
        try:
            query = _get_supabase().table(SUPABASE_ALERTS_TABLE).delete()
            if user_id:
                query = query.eq("user_id", user_id)
            else:
                query = query.neq("id", 0)
            query.execute()
            logger.info(
                "Alerts cleared from Supabase%s.",
                f" for user {user_id}" if user_id else "",
            )
            return
        except Exception as e:
            logger.error(f"clear_alerts failed: {e}")
            raise

    try:
        conn = get_connection()
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM alerts WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("DELETE FROM alerts")
        conn.commit()
        logger.info(
            "Alerts cleared from SQLite%s.",
            f" for user {user_id}" if user_id else "",
        )
    except sqlite3.Error as e:
        logger.error(f"clear_alerts failed: {e}")
        raise
    finally:
        conn.close()


def get_runtime_state(key: str):
    """Returns private API runtime state, or None when no value is stored."""
    if _use_supabase():
        try:
            response = (
                _get_supabase()
                .table(SUPABASE_RUNTIME_STATE_TABLE)
                .select("value")
                .eq("key", key)
                .limit(1)
                .execute()
            )
            if not response.data:
                return None
            return response.data[0]["value"]
        except Exception as e:
            logger.warning(
                "Runtime state could not be read from Supabase (%s). "
                "Apply supabase/runtime_state_schema.sql to enable restart recovery.",
                e,
            )
            return None

    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM runtime_state WHERE key = ?",
            (key,),
        ).fetchone()
        return json.loads(row["value"]) if row else None
    except (sqlite3.Error, json.JSONDecodeError) as e:
        logger.warning("Runtime state could not be read from SQLite: %s", e)
        return None
    finally:
        conn.close()


def set_runtime_state(key: str, value: dict) -> bool:
    """Stores private API runtime state without exposing it to dashboard users."""
    if _use_supabase():
        try:
            (
                _get_supabase()
                .table(SUPABASE_RUNTIME_STATE_TABLE)
                .upsert({"key": key, "value": value}, on_conflict="key")
                .execute()
            )
            return True
        except Exception as e:
            logger.warning(
                "Runtime state could not be saved to Supabase (%s). "
                "The API will continue with in-memory state.",
                e,
            )
            return False

    try:
        conn = get_connection()
        conn.execute(
            """
            INSERT INTO runtime_state (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
            """,
            (key, json.dumps(value)),
        )
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.warning("Runtime state could not be saved to SQLite: %s", e)
        return False
    finally:
        conn.close()


def clear_runtime_state(key: str = None):
    """Test and maintenance helper for clearing persisted runtime state."""
    if _use_supabase():
        client = _get_supabase().table(SUPABASE_RUNTIME_STATE_TABLE).delete()
        if key is None:
            client.neq("key", "")
        else:
            client.eq("key", key)
        client.execute()
        return

    try:
        conn = get_connection()
        if key is None:
            conn.execute("DELETE FROM runtime_state")
        else:
            conn.execute("DELETE FROM runtime_state WHERE key = ?", (key,))
        conn.commit()
    finally:
        conn.close()
