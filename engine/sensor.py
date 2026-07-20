"""
Long-running ThreatScope network sensor.

The process stays alive as an operating-system service, reports health to the
API, and starts or pauses packet capture based on the dashboard command.
"""

import logging
import os
import signal
import socket
import threading
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from scapy.all import sniff


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from capture import handle_packet  # noqa: E402


VERSION = "1.0.0"
INTERFACE = os.getenv("NETWORK_INTERFACE", "en0")
SENSOR_ID = os.getenv("SENSOR_ID", socket.gethostname())
ENGINE_API_KEY = os.getenv("ENGINE_API_KEY", "").strip()
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("SENSOR_HEARTBEAT_INTERVAL_SECONDS", "5"))
CAPTURE_RETRY_SECONDS = int(os.getenv("SENSOR_CAPTURE_RETRY_SECONDS", "30"))
DEFAULT_MONITORING_ENABLED = (
    os.getenv("MONITORING_DEFAULT_ENABLED", "true").strip().lower() == "true"
)

_alerts_url = os.getenv("API_URL", "http://localhost:8000/alerts").rstrip("/")
API_BASE_URL = os.getenv("API_BASE_URL", _alerts_url.removesuffix("/alerts")).rstrip("/")
HEARTBEAT_URL = f"{API_BASE_URL}/sensor/heartbeat"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("threatscope.sensor")


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
        headers = {"X-Engine-Key": ENGINE_API_KEY} if ENGINE_API_KEY else {}
        try:
            response = self._session.post(
                HEARTBEAT_URL,
                json=self.snapshot(),
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            command = response.json()
            self.desired_monitoring = bool(command["monitoring_enabled"])
        except requests.RequestException as exc:
            log.warning("Heartbeat failed; monitoring continues with the last command: %s", exc)

    def run(self):
        log.info("ThreatScope sensor service starting as %s", SENSOR_ID)
        log.info("API: %s | interface: %s", API_BASE_URL, INTERFACE)

        while not self._shutdown.is_set():
            if self.desired_monitoring:
                self.start_monitoring()
            else:
                self.stop_monitoring()

            self.send_heartbeat()
            self._shutdown.wait(HEARTBEAT_INTERVAL_SECONDS)

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
