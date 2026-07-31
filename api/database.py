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
SUPABASE_SENSOR_ENROLLMENTS_TABLE = (
    os.getenv("SUPABASE_SENSOR_ENROLLMENTS_TABLE", "sensor_enrollment_codes").strip()
    or "sensor_enrollment_codes"
)
SUPABASE_SENSORS_TABLE = (
    os.getenv("SUPABASE_SENSORS_TABLE", "sensors").strip()
    or "sensors"
)
SUPABASE_SCAN_STATE_TABLE = (
    os.getenv("SUPABASE_SCAN_STATE_TABLE", "sensor_scan_state").strip()
    or "sensor_scan_state"
)
SUPABASE_ACTIVE = False


def _use_supabase() -> bool:
    return SUPABASE_ACTIVE


def _get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
            client.table(SUPABASE_ALERTS_TABLE).select(
                "id,user_id,sensor_id", count="exact"
            ).limit(1).execute()
            client.table(SUPABASE_SENSORS_TABLE).select(
                "id,owner_id,desired_monitoring,monitoring,interface,packet_count,last_error"
            ).limit(1).execute()
            client.table(SUPABASE_SCAN_STATE_TABLE).select(
                "sensor_id,owner_id,state,enabled"
            ).limit(1).execute()
            SUPABASE_ACTIVE = True
            logger.info("Supabase connection verified successfully.")
            return
        except Exception as e:
            if os.getenv("ALLOW_DATABASE_FALLBACK", "false").strip().lower() != "true":
                raise RuntimeError(
                    "Supabase or its required multi-user schema is unavailable; "
                    "apply the SQL migrations and verify backend credentials. "
                    "Refusing to use ephemeral SQLite."
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
                user_id   TEXT,
                sensor_id TEXT
            )
        """)
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(alerts)")}
        if "user_id" not in columns:
            cursor.execute("ALTER TABLE alerts ADD COLUMN user_id TEXT")
        if "sensor_id" not in columns:
            cursor.execute("ALTER TABLE alerts ADD COLUMN sensor_id TEXT")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS runtime_state (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sensor_enrollment_codes (
                id          TEXT PRIMARY KEY,
                owner_id    TEXT NOT NULL,
                code_hash   TEXT NOT NULL UNIQUE,
                expires_at  TEXT NOT NULL,
                used_at     TEXT,
                created_at  TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sensors (
                id          TEXT PRIMARY KEY,
                owner_id    TEXT NOT NULL,
                name        TEXT NOT NULL,
                platform    TEXT NOT NULL,
                version     TEXT NOT NULL,
                token_hash  TEXT NOT NULL UNIQUE,
                created_at  TEXT NOT NULL,
                last_seen_at TEXT,
                revoked_at  TEXT,
                desired_monitoring INTEGER NOT NULL DEFAULT 1,
                monitoring INTEGER NOT NULL DEFAULT 0,
                interface TEXT,
                packet_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            )
        """)
        sensor_columns = {row[1] for row in cursor.execute("PRAGMA table_info(sensors)")}
        sensor_additions = {
            "desired_monitoring": "INTEGER NOT NULL DEFAULT 1",
            "monitoring": "INTEGER NOT NULL DEFAULT 0",
            "interface": "TEXT",
            "packet_count": "INTEGER NOT NULL DEFAULT 0",
            "last_error": "TEXT",
        }
        for column, definition in sensor_additions.items():
            if column not in sensor_columns:
                cursor.execute(f"ALTER TABLE sensors ADD COLUMN {column} {definition}")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sensor_scan_state (
                sensor_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 0,
                interval_minutes INTEGER NOT NULL DEFAULT 5,
                state TEXT NOT NULL DEFAULT 'idle',
                message TEXT NOT NULL DEFAULT 'Scheduled assessments are off.',
                last_started_at TEXT,
                last_finished_at TEXT,
                next_scan_at TEXT,
                baseline_alert_count INTEGER NOT NULL DEFAULT 0,
                baseline_packet_count INTEGER NOT NULL DEFAULT 0,
                packets_analyzed INTEGER NOT NULL DEFAULT 0,
                alerts_detected INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS sensor_enrollment_one_active_per_owner
            ON sensor_enrollment_codes (owner_id) WHERE used_at IS NULL
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS sensors_owner_idx ON sensors (owner_id, created_at DESC)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS sensor_scan_state_owner_idx ON sensor_scan_state (owner_id)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS alerts_sensor_id_idx ON alerts (sensor_id)"
        )
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
    alert = {**alert, "sensor_id": alert.get("sensor_id")}
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
            INSERT INTO alerts (type, src_ip, dst_ip, severity, message, timestamp, user_id, sensor_id)
            VALUES (:type, :src_ip, :dst_ip, :severity, :message, :timestamp, :user_id, :sensor_id)
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
    sensor_id: str = None,
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
            if sensor_id:
                query = query.eq("sensor_id", sensor_id)
            upper = offset + limit - 1
            response = query.range(offset, upper).execute()
            return response.data
        except Exception as e:
            logger.error(f"get_alerts failed: {e}")
            raise

    try:
        conn = get_connection()
        cursor = conn.cursor()
        clauses = []
        params = []
        if severity:
            clauses.append("severity = ?")
            params.append(severity)
        if user_id:
            clauses.append("user_id = ?")
            params.append(user_id)
        if sensor_id:
            clauses.append("sensor_id = ?")
            params.append(sensor_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        cursor.execute(
            f"SELECT * FROM alerts {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (*params, limit, offset),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        logger.error(f"get_alerts failed: {e}")
        raise
    finally:
        conn.close()


def get_summary(user_id: str = None, sensor_id: str = None):
    """
    Returns a count of alerts grouped by severity.
    """
    alerts = get_alerts(limit=10000, offset=0, user_id=user_id, sensor_id=sensor_id)
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


def get_stats(group_by: Optional[str] = None, user_id: str = None, sensor_id: str = None):
    """
    Returns chart-ready stats for the dashboard.
    """
    alerts = list(reversed(get_alerts(
        limit=10000,
        offset=0,
        user_id=user_id,
        sensor_id=sensor_id,
    )))

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


def clear_alerts(user_id: str = None, sensor_id: str = None):
    """
    Deletes alerts from the backing store, optionally scoped to one user.
    """
    if _use_supabase():
        try:
            query = _get_supabase().table(SUPABASE_ALERTS_TABLE).delete()
            if user_id:
                query = query.eq("user_id", user_id)
            if sensor_id:
                query = query.eq("sensor_id", sensor_id)
            if not user_id and not sensor_id:
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
        clauses = []
        params = []
        if user_id:
            clauses.append("user_id = ?")
            params.append(user_id)
        if sensor_id:
            clauses.append("sensor_id = ?")
            params.append(sensor_id)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        cursor.execute(f"DELETE FROM alerts{where}", params)
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


def create_sensor_enrollment(record: dict):
    """Stores a hashed, short-lived enrollment code and invalidates older codes."""
    if _use_supabase():
        client = _get_supabase()
        client.table(SUPABASE_SENSOR_ENROLLMENTS_TABLE).update({
            "used_at": record["created_at"],
        }).eq("owner_id", record["owner_id"]).is_("used_at", "null").execute()
        client.table(SUPABASE_SENSOR_ENROLLMENTS_TABLE).insert(record).execute()
        return

    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE sensor_enrollment_codes SET used_at = ? WHERE owner_id = ? AND used_at IS NULL",
            (record["created_at"], record["owner_id"]),
        )
        conn.execute(
            """
            INSERT INTO sensor_enrollment_codes
                (id, owner_id, code_hash, expires_at, used_at, created_at)
            VALUES (:id, :owner_id, :code_hash, :expires_at, :used_at, :created_at)
            """,
            record,
        )
        conn.commit()
    finally:
        conn.close()


def consume_sensor_enrollment(code_hash: str, sensor: dict, max_sensors: int = 10):
    """Atomically consumes one enrollment code and creates a sensor credential."""
    if _use_supabase():
        response = _get_supabase().rpc("consume_sensor_enrollment", {
            "p_code_hash": code_hash,
            "p_sensor_id": sensor["id"],
            "p_name": sensor["name"],
            "p_platform": sensor["platform"],
            "p_version": sensor["version"],
            "p_token_hash": sensor["token_hash"],
            "p_max_sensors": max(1, min(int(max_sensors), 50)),
        }).execute()
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT id, owner_id FROM sensor_enrollment_codes
            WHERE code_hash = ? AND used_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP
            LIMIT 1
            """,
            (code_hash,),
        ).fetchone()
        if not row:
            conn.rollback()
            return None
        active_count = conn.execute(
            "SELECT count(*) FROM sensors WHERE owner_id = ? AND revoked_at IS NULL",
            (row["owner_id"],),
        ).fetchone()[0]
        if active_count >= max(1, min(int(max_sensors), 50)):
            conn.rollback()
            return None
        updated = conn.execute(
            "UPDATE sensor_enrollment_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL",
            (row["id"],),
        )
        if updated.rowcount != 1:
            conn.rollback()
            return None
        conn.execute(
            """
            INSERT INTO sensors
                (id, owner_id, name, platform, version, token_hash, created_at, last_seen_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
            """,
            (
                sensor["id"], row["owner_id"], sensor["name"], sensor["platform"],
                sensor["version"], sensor["token_hash"], sensor["created_at"],
            ),
        )
        conn.commit()
        return {"id": sensor["id"], "owner_id": row["owner_id"]}
    finally:
        conn.close()


def get_sensor_credential(sensor_id: str):
    """Returns private sensor authentication data for API-side verification."""
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SENSORS_TABLE)
            .select("id,owner_id,token_hash,revoked_at")
            .eq("id", sensor_id).limit(1).execute()
        )
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, owner_id, token_hash, revoked_at FROM sensors WHERE id = ? LIMIT 1",
            (sensor_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def mark_sensor_seen(sensor_id: str, version: str = None):
    """Updates non-secret sensor health metadata after successful authentication."""
    if _use_supabase():
        values = {"last_seen_at": "now()"}
        # PostgREST does not evaluate SQL expressions in update values.
        from datetime import datetime, timezone
        values["last_seen_at"] = datetime.now(timezone.utc).isoformat()
        if version:
            values["version"] = version
        _get_supabase().table(SUPABASE_SENSORS_TABLE).update(values).eq("id", sensor_id).execute()
        return

    conn = get_connection()
    try:
        if version:
            conn.execute(
                "UPDATE sensors SET last_seen_at = CURRENT_TIMESTAMP, version = ? WHERE id = ?",
                (version, sensor_id),
            )
        else:
            conn.execute(
                "UPDATE sensors SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
                (sensor_id,),
            )
        conn.commit()
    finally:
        conn.close()


def list_sensors(owner_id: str):
    """Lists only safe sensor metadata for the owning dashboard account."""
    columns = (
        "id,name,platform,version,created_at,last_seen_at,revoked_at,"
        "desired_monitoring,monitoring,interface,packet_count,last_error"
    )
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SENSORS_TABLE).select(columns)
            .eq("owner_id", owner_id).order("created_at", desc=True).execute()
        )
        return response.data

    conn = get_connection()
    try:
        rows = conn.execute(
            f"SELECT {columns} FROM sensors WHERE owner_id = ? ORDER BY created_at DESC",
            (owner_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_owned_sensor(sensor_id: str, owner_id: str):
    """Returns safe sensor state only when the active sensor belongs to the owner."""
    columns = (
        "id,owner_id,name,platform,version,created_at,last_seen_at,revoked_at,"
        "desired_monitoring,monitoring,interface,packet_count,last_error"
    )
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SENSORS_TABLE).select(columns)
            .eq("id", sensor_id).eq("owner_id", owner_id)
            .is_("revoked_at", "null").limit(1).execute()
        )
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        row = conn.execute(
            f"SELECT {columns} FROM sensors "
            "WHERE id = ? AND owner_id = ? AND revoked_at IS NULL LIMIT 1",
            (sensor_id, owner_id),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_sensor_heartbeat(sensor_id: str, owner_id: str, heartbeat: dict):
    """Atomically updates one owned sensor and returns its monitoring command."""
    from datetime import datetime, timezone
    values = {
        "interface": heartbeat["interface"],
        "monitoring": bool(heartbeat["monitoring"]),
        "packet_count": max(0, int(heartbeat["packet_count"])),
        "last_error": heartbeat.get("last_error"),
        "version": heartbeat["version"],
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SENSORS_TABLE).update(values)
            .eq("id", sensor_id).eq("owner_id", owner_id)
            .is_("revoked_at", "null").execute()
        )
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        result = conn.execute(
            """
            UPDATE sensors SET
                interface = :interface,
                monitoring = :monitoring,
                packet_count = :packet_count,
                last_error = :last_error,
                version = :version,
                last_seen_at = :last_seen_at
            WHERE id = :sensor_id AND owner_id = :owner_id AND revoked_at IS NULL
            """,
            {**values, "sensor_id": sensor_id, "owner_id": owner_id},
        )
        if result.rowcount != 1:
            conn.rollback()
            return None
        row = conn.execute(
            "SELECT * FROM sensors WHERE id = ? AND owner_id = ?",
            (sensor_id, owner_id),
        ).fetchone()
        conn.commit()
        return dict(row)
    finally:
        conn.close()


def set_sensor_monitoring_state(sensor_id: str, owner_id: str, enabled: bool):
    """Changes only the desired state of one active sensor owned by the caller."""
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SENSORS_TABLE)
            .update({"desired_monitoring": bool(enabled)})
            .eq("id", sensor_id).eq("owner_id", owner_id)
            .is_("revoked_at", "null").execute()
        )
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        result = conn.execute(
            """
            UPDATE sensors SET desired_monitoring = ?
            WHERE id = ? AND owner_id = ? AND revoked_at IS NULL
            """,
            (int(bool(enabled)), sensor_id, owner_id),
        )
        if result.rowcount != 1:
            conn.rollback()
            return None
        row = conn.execute(
            "SELECT * FROM sensors WHERE id = ? AND owner_id = ?",
            (sensor_id, owner_id),
        ).fetchone()
        conn.commit()
        return dict(row)
    finally:
        conn.close()


def get_scan_state(sensor_id: str, owner_id: str):
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SCAN_STATE_TABLE).select("*")
            .eq("sensor_id", sensor_id).eq("owner_id", owner_id).limit(1).execute()
        )
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM sensor_scan_state WHERE sensor_id = ? AND owner_id = ? LIMIT 1",
            (sensor_id, owner_id),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def save_scan_state(record: dict):
    """Persists scan state after confirming the sensor-owner relationship."""
    if _use_supabase():
        response = (
            _get_supabase().table(SUPABASE_SCAN_STATE_TABLE)
            .upsert(record, on_conflict="sensor_id").execute()
        )
        return response.data[0] if response.data else None

    conn = get_connection()
    try:
        owner = conn.execute(
            "SELECT owner_id FROM sensors WHERE id = ? AND revoked_at IS NULL",
            (record["sensor_id"],),
        ).fetchone()
        if not owner or owner["owner_id"] != record["owner_id"]:
            raise ValueError("Sensor ownership mismatch")
        columns = (
            "sensor_id,owner_id,enabled,interval_minutes,state,message,"
            "last_started_at,last_finished_at,next_scan_at,baseline_alert_count,"
            "baseline_packet_count,packets_analyzed,alerts_detected"
        )
        placeholders = ",".join(f":{column}" for column in columns.split(","))
        updates = ",".join(
            f"{column}=excluded.{column}"
            for column in columns.split(",")
            if column not in {"sensor_id", "owner_id"}
        )
        conn.execute(
            f"""
            INSERT INTO sensor_scan_state ({columns}) VALUES ({placeholders})
            ON CONFLICT(sensor_id) DO UPDATE SET {updates}, updated_at=CURRENT_TIMESTAMP
            """,
            record,
        )
        conn.commit()
        return get_scan_state(record["sensor_id"], record["owner_id"])
    finally:
        conn.close()


def list_scan_states():
    """Returns private scan records for the single scheduler worker."""
    if _use_supabase():
        return _get_supabase().table(SUPABASE_SCAN_STATE_TABLE).select("*").execute().data

    conn = get_connection()
    try:
        return [dict(row) for row in conn.execute("SELECT * FROM sensor_scan_state").fetchall()]
    finally:
        conn.close()


def list_scheduler_scan_states():
    """Returns only records that can require work from the scheduler."""
    if _use_supabase():
        return (
            _get_supabase().table(SUPABASE_SCAN_STATE_TABLE).select("*")
            .or_("state.eq.running,enabled.eq.true").execute().data
        )

    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM sensor_scan_state WHERE state = 'running' OR enabled = 1"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def clear_scan_states(owner_id: str = None):
    if _use_supabase():
        query = _get_supabase().table(SUPABASE_SCAN_STATE_TABLE).delete()
        if owner_id:
            query = query.eq("owner_id", owner_id)
        else:
            query = query.neq("sensor_id", "00000000-0000-0000-0000-000000000000")
        query.execute()
        return

    conn = get_connection()
    try:
        if owner_id:
            conn.execute("DELETE FROM sensor_scan_state WHERE owner_id = ?", (owner_id,))
        else:
            conn.execute("DELETE FROM sensor_scan_state")
        conn.commit()
    finally:
        conn.close()


def revoke_sensor(sensor_id: str, owner_id: str = None):
    """Revokes a credential, optionally enforcing ownership in the update itself."""
    from datetime import datetime, timezone
    revoked_at = datetime.now(timezone.utc).isoformat()
    if _use_supabase():
        query = _get_supabase().table(SUPABASE_SENSORS_TABLE).update({
            "revoked_at": revoked_at,
        }).eq("id", sensor_id)
        if owner_id:
            query = query.eq("owner_id", owner_id)
        response = query.is_("revoked_at", "null").execute()
        if response.data:
            (
                _get_supabase().table(SUPABASE_SCAN_STATE_TABLE)
                .update({"enabled": False, "next_scan_at": None})
                .eq("sensor_id", sensor_id).execute()
            )
        return bool(response.data)

    conn = get_connection()
    try:
        if owner_id:
            result = conn.execute(
                "UPDATE sensors SET revoked_at = ? WHERE id = ? AND owner_id = ? AND revoked_at IS NULL",
                (revoked_at, sensor_id, owner_id),
            )
        else:
            result = conn.execute(
                "UPDATE sensors SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
                (revoked_at, sensor_id),
            )
        conn.commit()
        if result.rowcount == 1:
            conn.execute(
                "UPDATE sensor_scan_state SET enabled = 0, next_scan_at = NULL WHERE sensor_id = ?",
                (sensor_id,),
            )
            conn.commit()
        return result.rowcount == 1
    finally:
        conn.close()
