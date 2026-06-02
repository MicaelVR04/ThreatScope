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
    4. ARP Spoof detection      — multiple MAC addresses claiming the same IP
"""

import os
import ipaddress
from time import time
from scapy.all import ARP, IP, TCP, ICMP
from collections import defaultdict
from datetime import datetime
from dotenv import load_dotenv
from severity import score_severity

load_dotenv()

# ── State tracking ─────────────────────────────────────────────────────────
# These dicts track packet counts per source IP over time
# They reset when the engine restarts (in-memory only for now)

# { src_ip: set of destination ports seen }
port_scan_tracker = defaultdict(set)

# { src_ip: count of SYN packets seen }
syn_flood_tracker = defaultdict(int)

# { src_ip: set of destination IPs pinged }
ping_sweep_tracker = defaultdict(set)

# { claimed_ip: observed_mac }
arp_claim_tracker = {}

# { (alert_type, src_ip, dst_ip): last_sent_unix_time }
alert_cooldowns = {}

# ── Thresholds ─────────────────────────────────────────────────────────────
# Tune these values to reduce false positives
PORT_SCAN_THRESHOLD = 10     # unique ports hit by one IP before alerting
SYN_FLOOD_THRESHOLD = 100    # SYN packets from one IP before alerting
PING_SWEEP_THRESHOLD = 5     # unique IPs pinged by one IP before alerting

# ── Demo stability controls ────────────────────────────────────────────────
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "60"))
ALLOWED_SUBNETS = [
    ipaddress.ip_network(value.strip(), strict=False)
    for value in os.getenv("ALLOWED_SUBNETS", "").split(",")
    if value.strip()
]


def _parse_ip(value):
    try:
        return ipaddress.ip_address(value)
    except ValueError:
        return None


def packet_allowed(packet):
    """
    Filters noisy traffic during demos.
    In demo mode, only LAN/private traffic or explicitly allowed subnets are considered.
    """
    if packet.haslayer(ARP):
        src_ip = _parse_ip(packet[ARP].psrc)
        dst_ip = _parse_ip(packet[ARP].pdst)
    elif packet.haslayer(IP):
        src_ip = _parse_ip(packet[IP].src)
        dst_ip = _parse_ip(packet[IP].dst)
    else:
        return False

    if not src_ip or not dst_ip:
        return False

    if src_ip.is_loopback or dst_ip.is_loopback:
        return False

    if ALLOWED_SUBNETS:
        return any(src_ip in subnet or dst_ip in subnet for subnet in ALLOWED_SUBNETS)

    if DEMO_MODE:
        return src_ip.is_private and dst_ip.is_private

    return True


def should_emit_alert(alert_type, src_ip, dst_ip):
    """
    Suppresses duplicate alerts from the same source for a short cooldown window.
    """
    now = time()
    key = (alert_type, src_ip, dst_ip)
    last_sent = alert_cooldowns.get(key)
    if last_sent and now - last_sent < ALERT_COOLDOWN_SECONDS:
        return False

    alert_cooldowns[key] = now
    return True


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
    if not packet_allowed(packet):
        return None

    alert = (
        detect_arp_spoof(packet) or
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


# ── Rule 4: ARP Spoof ──────────────────────────────────────────────────────
def detect_arp_spoof(packet):
    """
    Detects ARP spoofing by watching for multiple MAC addresses claiming
    ownership of the same IPv4 address.
    """
    if not packet.haslayer(ARP):
        return None

    arp_layer = packet[ARP]

    # ARP reply/op=2 is the strongest signal for poisoning attempts.
    if arp_layer.op != 2:
        return None

    claimed_ip = arp_layer.psrc
    claimed_mac = arp_layer.hwsrc.lower()
    previous_mac = arp_claim_tracker.get(claimed_ip)

    if previous_mac is None:
        arp_claim_tracker[claimed_ip] = claimed_mac
        return None

    if previous_mac == claimed_mac:
        return None

    arp_claim_tracker[claimed_ip] = claimed_mac
    return build_alert(
        alert_type="ARP_SPOOF",
        src_ip=claimed_ip,
        dst_ip=arp_layer.pdst,
        message=(
            f"{claimed_ip} changed ARP ownership from {previous_mac} "
            f"to {claimed_mac} — possible ARP spoofing"
        ),
    )


# ── Alert builder ──────────────────────────────────────────────────────────
def build_alert(alert_type, src_ip, dst_ip, message):
    """
    Builds a structured alert dict with severity scoring.
    All rules use this so the alert format is always consistent.
    """
    if not should_emit_alert(alert_type, src_ip, dst_ip):
        return None

    severity = score_severity(alert_type)

    return {
        "type":      alert_type,
        "src_ip":    src_ip,
        "dst_ip":    dst_ip,
        "severity":  severity,
        "message":   message,
        "timestamp": datetime.utcnow().isoformat()
    }
