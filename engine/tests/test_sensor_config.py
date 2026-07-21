import os
import stat
import sys
from pathlib import Path

import pytest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensor_config import persist_sensor_credential, require_secure_api_url


def test_remote_sensor_api_requires_https():
    require_secure_api_url("https://api.example.com")
    require_secure_api_url("http://127.0.0.1:8000")

    with pytest.raises(RuntimeError, match="must use HTTPS"):
        require_secure_api_url("http://api.example.com")


def test_enrollment_code_is_atomically_replaced_by_private_credential(tmp_path, monkeypatch):
    config = tmp_path / "sensor.env"
    config.write_text(
        "API_BASE_URL=https://api.example.com\nSENSOR_ENROLLMENT_CODE=temporary-code\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("THREATSCOPE_CONFIG_PATH", str(config))
    monkeypatch.setenv("SENSOR_ENROLLMENT_CODE", "temporary-code")

    sensor_id = "93a63264-4063-47ce-93e6-86575d1cc137"
    token = f"ts1.{sensor_id}.abcdefghijklmnopqrstuvwxyzABCDEFGH"
    persist_sensor_credential(sensor_id, token)

    stored = config.read_text(encoding="utf-8")
    assert "SENSOR_ENROLLMENT_CODE=" not in stored
    assert f"SENSOR_ID={sensor_id}" in stored
    assert f"SENSOR_TOKEN={token}" in stored
    assert stat.S_IMODE(config.stat().st_mode) == 0o600
    assert "SENSOR_ENROLLMENT_CODE" not in os.environ
