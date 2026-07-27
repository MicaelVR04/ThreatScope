"""Configuration and credential storage shared by sensor entry points."""

import os
import stat
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


def config_path() -> Path:
    configured = os.getenv("THREATSCOPE_CONFIG_PATH", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[1] / ".env"


def load_sensor_environment():
    load_dotenv(config_path(), override=False)


def require_secure_api_url(api_base_url: str):
    parsed = urlparse(api_base_url)
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme == "https" and parsed.netloc:
        return
    if parsed.scheme == "http" and parsed.hostname in local_hosts:
        return
    raise RuntimeError("Sensor API URL must use HTTPS (HTTP is allowed only for localhost).")


def sensor_auth_headers() -> dict:
    sensor_token = os.getenv("SENSOR_TOKEN", "").strip()
    if sensor_token:
        return {"X-Sensor-Token": sensor_token}
    engine_key = os.getenv("ENGINE_API_KEY", "").strip()
    return {"X-Engine-Key": engine_key} if engine_key else {}


def persist_sensor_credential(sensor_id: str, sensor_token: str):
    """Atomically replaces the one-time code with the root-only credential."""
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    removed = {"SENSOR_ENROLLMENT_CODE", "SENSOR_ID", "SENSOR_TOKEN"}
    retained = [
        line for line in existing
        if line.split("=", 1)[0].strip() not in removed
    ]
    retained.extend([
        f"SENSOR_ID={sensor_id}",
        f"SENSOR_TOKEN={sensor_token}",
    ])

    fd, temporary = tempfile.mkstemp(prefix=".threatscope-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("\n".join(retained).rstrip() + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, stat.S_IRUSR | stat.S_IWUSR)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

    os.environ.pop("SENSOR_ENROLLMENT_CODE", None)
    os.environ["SENSOR_ID"] = sensor_id
    os.environ["SENSOR_TOKEN"] = sensor_token
