"""
rules.py — Detection rules engine for ThreatScope
Micael Velez Rodriguez owns this file.

Responsibilities:
- Analyze each captured packet against known attack signatures
- Return a structured alert dict if a threat is detected
- Return None if the packet is clean

Current rules:
    1. Port Scan detection      — many packets to different ports from one IP
    2. SYN Flood detection      — flood of SYN packets from one IP
    3. Ping Sweep detection     — ICMP echo requests to many different IPs
"""

from scapy.all import IP, TCP, ICMP
from collections import defaultdict
from datetime import datetime
from severity import score_severity

# ── State tracking ─────────────────────────────────────────────────────────
# These dicts track packet counts per source IP over time
# They reset when the engine restarts (in-memory only for now)

# { src_ip: set of destination ports seen }
port_scan_tracker = defaultdict(set)

# { src_ip: count of SYN packets seen }
syn_flood_tracker = defaultdict(int)

# { src_ip: set of destination IPs pinged }
ping_sweep_tracker = defaultdict(set)

# ── Thresholds ─────────────────────────────────────────────────────────────
# Tune these values to reduce false positives
PORT_SCAN_THRESHOLD = 10     # unique ports hit by one IP before alerting
SYN_FLOOD_THRESHOLD = 100    # SYN packets from one IP before alerting
PING_SWEEP_THRESHOLD = 5     # unique IPs pinged by one IP before alerting


# ── Main entry point ───────────────────────────────────────────────────────
def analyze_packet(packet):
    """
    Analyzes a single packet against all detection rules.
    Returns an alert dict if a threat is detected, otherwise None.

    Alert dict structure:
    {
        "type":      str,   # e.g. "PORT_SCAN"
        "src_ip":    str,   # source IP address
        "dst_ip":    str,   # destination IP address (if applicable)
        "severity":  str,   # "LOW", "MEDIUM", or "HIGH"
        "message":   str,   # human-readable description
        "timestamp": str,   # ISO format timestamp
    }
    """
    # Only analyze packets that have an IP layer
    if not packet.haslayer(IP):
        return None

    alert = (
        detect_port_scan(packet) or
        detect_syn_flood(packet) or
        detect_ping_sweep(packet)
    )

    return alert


# ── Rule 1: Port Scan ──────────────────────────────────────────────────────
def detect_port_scan(packet):
    """
    Detects port scanning: one source IP hitting many different destination ports.
    Classic behavior of tools like nmap.
    """
    if not (packet.haslayer(IP) and packet.haslayer(TCP)):
        return None

    src_ip = packet[IP].src
    dst_port = packet[TCP].dport

    port_scan_tracker[src_ip].add(dst_port)

    if len(port_scan_tracker[src_ip]) >= PORT_SCAN_THRESHOLD:
        port_scan_tracker[src_ip].clear()  # reset after alerting
        return build_alert(
            alert_type="PORT_SCAN",
            src_ip=src_ip,
            dst_ip=packet[IP].dst,
            message=f"{src_ip} scanned {PORT_SCAN_THRESHOLD}+ ports — possible port scan"
        )

    return None


# ── Rule 2: SYN Flood ──────────────────────────────────────────────────────
def detect_syn_flood(packet):
    """
    Detects SYN flood attacks: a flood of TCP SYN packets from one IP
    without completing the handshake — classic DoS technique.
    """
    if not (packet.haslayer(IP) and packet.haslayer(TCP)):
        return None

    # SYN flag is set when TCP flags == 0x02
    if packet[TCP].flags != 0x02:
        return None

    src_ip = packet[IP].src
    syn_flood_tracker[src_ip] += 1

    if syn_flood_tracker[src_ip] >= SYN_FLOOD_THRESHOLD:
        syn_flood_tracker[src_ip] = 0  # reset after alerting
        return build_alert(
            alert_type="SYN_FLOOD",
            src_ip=src_ip,
            dst_ip=packet[IP].dst,
            message=f"{src_ip} sent {SYN_FLOOD_THRESHOLD}+ SYN packets — possible SYN flood"
        )

    return None


# ── Rule 3: Ping Sweep ─────────────────────────────────────────────────────
def detect_ping_sweep(packet):
    """
    Detects ping sweeps: one source IP sending ICMP echo requests
    to many different destination IPs — used to discover live hosts.
    """
    if not (packet.haslayer(IP) and packet.haslayer(ICMP)):
        return None

    # ICMP type 8 = echo request (a ping)
    if packet[ICMP].type != 8:
        return None

    src_ip = packet[IP].src
    dst_ip = packet[IP].dst

    ping_sweep_tracker[src_ip].add(dst_ip)

    if len(ping_sweep_tracker[src_ip]) >= PING_SWEEP_THRESHOLD:
        ping_sweep_tracker[src_ip].clear()  # reset after alerting
        return build_alert(
            alert_type="PING_SWEEP",
            src_ip=src_ip,
            dst_ip=dst_ip,
            message=f"{src_ip} pinged {PING_SWEEP_THRESHOLD}+ hosts — possible ping sweep"
        )

    return None


# ── Alert builder ──────────────────────────────────────────────────────────
def build_alert(alert_type, src_ip, dst_ip, message):
    """
    Builds a structured alert dict with severity scoring.
    All rules use this so the alert format is always consistent.
    """
    severity = score_severity(alert_type)

    return {
        "type":      alert_type,
        "src_ip":    src_ip,
        "dst_ip":    dst_ip,
        "severity":  severity,
        "message":   message,
        "timestamp": datetime.utcnow().isoformat()
    }
