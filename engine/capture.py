"""
capture.py — Packet capture module for ThreatScope
Person 1 owns this file.

Responsibilities:
- Start a live packet capture on the configured network interface
- Pass each captured packet to the detection rules engine
- Send alerts to the API when a threat is detected
"""

import os
import logging
from pathlib import Path
from scapy.all import sniff
from dotenv import load_dotenv
from rules import analyze_packet
from alert_sender import send_alert
# ── Setup ──────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

INTERFACE = os.getenv("NETWORK_INTERFACE", "en0")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)


# ── Packet handler ─────────────────────────────────────────────────────────
def handle_packet(packet):
    """
    Called automatically by Scapy for every captured packet.
    Passes the packet to the rules engine for analysis.
    """
    alert = analyze_packet(packet)

    if alert:
        log.warning(
            f"ALERT | Type: {alert['type']} | "
            f"Source: {alert['src_ip']} | "
            f"Severity: {alert['severity']}"
        )
        
        send_alert(alert)


# ── Entry point ────────────────────────────────────────────────────────────
def start_capture():
    """
    Starts live packet capture on the configured network interface.
    Runs indefinitely until manually stopped (Ctrl+C).
    """
    log.info(f"ThreatScope engine starting on interface: {INTERFACE}")
    log.info("Listening for suspicious traffic... (Ctrl+C to stop)")

    try:
        sniff(
            iface=INTERFACE,
            prn=handle_packet,   # call handle_packet for every packet
            store=False,         # don't store packets in memory (saves RAM)
        )
    except PermissionError:
        log.error("Permission denied. Try running with sudo.")
    except KeyboardInterrupt:
        log.info("Capture stopped by user.")


if __name__ == "__main__":
    start_capture()
