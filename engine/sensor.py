"""
Long-running ThreatScope network sensor.

The process stays alive as an operating-system service, reports health to the
API, and starts or pauses packet capture based on the dashboard command.
"""

import logging
import os
import re
import signal
import socket
import threading
import time
from uuid import UUID

import requests
from scapy.all import sniff

from sensor_config import (
    load_sensor_environment,
    persist_sensor_credential,
    require_secure_api_url,
    sensor_auth_headers,
)

load_sensor_environment()


VERSION = "1.2.0"
INTERFACE = os.getenv("NETWORK_INTERFACE", "en0")
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("SENSOR_HEARTBEAT_INTERVAL_SECONDS", "5"))
CAPTURE_RETRY_SECONDS = int(os.getenv("SENSOR_CAPTURE_RETRY_SECONDS", "30"))
DEFAULT_MONITORING_ENABLED = (
    os.getenv("MONITORING_DEFAULT_ENABLED", "true").strip().lower() == "true"
)

_alerts_url = os.getenv("API_URL", "http://localhost:8000/alerts").rstrip("/")
API_BASE_URL = os.getenv("API_BASE_URL", _alerts_url.removesuffix("/alerts")).rstrip("/")
HEARTBEAT_URL = f"{API_BASE_URL}/sensor/heartbeat"
ENROLLMENT_URL = f"{API_BASE_URL}/sensors/enroll"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("threatscope.sensor")


def ensure_enrolled():
    """Exchanges an installation code before packet capture modules are loaded."""
    require_secure_api_url(API_BASE_URL)
    if os.getenv("SENSOR_TOKEN", "").strip():
        return

    code = os.getenv("SENSOR_ENROLLMENT_CODE", "").strip()
    if not code:
        raise RuntimeError("Sensor is not enrolled. Run the ThreatScope Sensor installer again.")
    response = requests.post(
        ENROLLMENT_URL,
        json={
            "code": code,
            "name": socket.gethostname(),
            "platform": "macOS",
            "version": VERSION,
        },
        timeout=15,
    )
    if response.status_code != 200:
        try:
            detail = response.json().get("detail")
        except ValueError:
            detail = None
        raise RuntimeError(detail or "ThreatScope could not enroll this sensor.")
    payload = response.json()
    sensor_id = str(payload.get("sensor_id", ""))
    sensor_token = str(payload.get("sensor_token", ""))
    try:
        sensor_id = str(UUID(sensor_id))
    except ValueError as exc:
        raise RuntimeError("ThreatScope returned an invalid enrollment response.") from exc
    token_parts = sensor_token.split(".")
    if (
        len(token_parts) != 3
        or token_parts[0] != "ts1"
        or token_parts[1] != sensor_id
        or not re.fullmatch(r"[A-Za-z0-9_-]{32,64}", token_parts[2])
    ):
        raise RuntimeError("ThreatScope returned an invalid enrollment response.")
    persist_sensor_credential(sensor_id, sensor_token)


ensure_enrolled()
SENSOR_ID = os.getenv("SENSOR_ID", socket.gethostname())

from capture import handle_packet  # noqa: E402


class NetworkSensor:
    def __init__(self):
        self.desired_monitoring = DEFAULT_MONITORING_ENABLED
        self.packet_count = 0
        self.last_error = None
        self._monitoring = False
        self._capture_thread = None
        self._capture_stop = threading.Event()
        self._shutdown = threading.Event()
        self._capture_retry_at = 0
        self._heartbeat_interval_seconds = HEARTBEAT_INTERVAL_SECONDS
        self._lock = threading.Lock()
        self._session = requests.Session()

    def snapshot(self):
        with self._lock:
            return {
                "sensor_id": SENSOR_ID,
                "interface": INTERFACE,
                "monitoring": self._monitoring,
                "packet_count": self.packet_count,
                "last_error": self.last_error,
                "version": VERSION,
            }

    def _handle_packet(self, packet):
        with self._lock:
            self.packet_count += 1
        handle_packet(packet)

    def _capture_loop(self):
        try:
            log.info("Packet monitoring started on interface %s", INTERFACE)
            while not self._capture_stop.is_set():
                sniff(
                    iface=INTERFACE,
                    prn=self._handle_packet,
                    store=False,
                    timeout=1,
                )
        except PermissionError:
            with self._lock:
                self.last_error = "Packet capture permission denied. Reinstall the sensor service with sudo."
            log.exception("Packet capture permission denied")
        except Exception as exc:
            with self._lock:
                self.last_error = (
                    "Packet capture permission denied. Reinstall the sensor service with sudo."
                    if "permission denied" in str(exc).lower()
                    else f"Packet capture failed: {exc}"
                )
                self._capture_retry_at = time.monotonic() + CAPTURE_RETRY_SECONDS
            log.exception("Packet capture failed")
        finally:
            with self._lock:
                self._monitoring = False
            log.info("Packet monitoring stopped")

    def start_monitoring(self):
        with self._lock:
            if self._monitoring:
                return
            if time.monotonic() < self._capture_retry_at:
                return
            self.last_error = None
            self._monitoring = True
            self._capture_stop.clear()
            self._capture_thread = threading.Thread(
                target=self._capture_loop,
                name="threatscope-packet-capture",
                daemon=True,
            )
            self._capture_thread.start()

    def stop_monitoring(self):
        with self._lock:
            self._capture_retry_at = 0
            self.last_error = None
            if not self._monitoring:
                return
            self._capture_stop.set()
            capture_thread = self._capture_thread
        if capture_thread:
            capture_thread.join(timeout=3)

    def send_heartbeat(self):
        try:
            response = self._session.post(
                HEARTBEAT_URL,
                json=self.snapshot(),
                headers=sensor_auth_headers(),
                timeout=10,
            )
            response.raise_for_status()
            command = response.json()
            self.desired_monitoring = bool(command["monitoring_enabled"])
            requested_interval = int(
                command.get("heartbeat_interval_seconds", HEARTBEAT_INTERVAL_SECONDS)
            )
            self._heartbeat_interval_seconds = max(2, min(requested_interval, 300))
        except requests.RequestException as exc:
            log.warning("Heartbeat failed; monitoring continues with the last command: %s", exc)
        except (TypeError, ValueError):
            log.warning("API returned an invalid heartbeat command; using the previous interval")

    def run(self):
        log.info("ThreatScope sensor service starting as %s", SENSOR_ID)
        log.info("API: %s | interface: %s", API_BASE_URL, INTERFACE)

        while not self._shutdown.is_set():
            if self.desired_monitoring:
                self.start_monitoring()
            else:
                self.stop_monitoring()

            self.send_heartbeat()
            self._shutdown.wait(self._heartbeat_interval_seconds)

        self.stop_monitoring()
        log.info("ThreatScope sensor service stopped")

    def shutdown(self, *_args):
        self._shutdown.set()


def main():
    sensor = NetworkSensor()
    signal.signal(signal.SIGTERM, sensor.shutdown)
    signal.signal(signal.SIGINT, sensor.shutdown)
    sensor.run()


if __name__ == "__main__":
    main()
