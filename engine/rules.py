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
from datetime import datetime, timezone
from dotenv import load_dotenv
from severity import score_severity

load_dotenv()

# ── State tracking ─────────────────────────────────────────────────────────
# These dicts track recent activity in bounded time windows.
# They reset when the engine restarts (in-memory only for now).

# { (src_ip, dst_ip): {destination_port: last_syn_time} }
port_scan_tracker = defaultdict(dict)

# { (src_ip, dst_ip): {(src_port, dst_port): last_syn_time} }
syn_flood_tracker = defaultdict(dict)

# { src_ip: {destination_ip: last_ping_time} }
ping_sweep_tracker = defaultdict(dict)

# { claimed_ip: {"mac": observed_mac, "last_seen": unix_time} }
arp_claim_tracker = {}

# { (claimed_ip, previous_mac, claimed_mac): {"count": int, "last_seen": unix_time} }
arp_conflict_tracker = {}

# { (alert_type, src_ip, dst_ip): last_sent_unix_time }
alert_cooldowns = {}

# ── Thresholds ─────────────────────────────────────────────────────────────
# Tune these values to reduce false positives
PORT_SCAN_THRESHOLD = 10     # unique ports hit on one target before alerting
SYN_FLOOD_THRESHOLD = 100    # unresolved SYN flows to one target before alerting
PING_SWEEP_THRESHOLD = 5     # unique IPs pinged by one IP before alerting
PORT_SCAN_WINDOW_SECONDS = int(os.getenv("PORT_SCAN_WINDOW_SECONDS", "10"))
SYN_FLOOD_WINDOW_SECONDS = int(os.getenv("SYN_FLOOD_WINDOW_SECONDS", "5"))
PING_SWEEP_WINDOW_SECONDS = int(os.getenv("PING_SWEEP_WINDOW_SECONDS", "10"))
TRACKER_CLEANUP_INTERVAL_SECONDS = int(os.getenv("TRACKER_CLEANUP_INTERVAL_SECONDS", "30"))
_last_tracker_cleanup = 0.0

# ── Demo stability controls ────────────────────────────────────────────────
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "60"))
ARP_ENTRY_TTL_SECONDS = int(os.getenv("ARP_ENTRY_TTL_SECONDS", "300"))
ARP_SPOOF_CONFIRMATION_THRESHOLD = int(os.getenv("ARP_SPOOF_CONFIRMATION_THRESHOLD", "2"))
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


def _is_initial_syn(tcp_layer):
    flags = int(tcp_layer.flags)
    return bool(flags & 0x02) and not bool(flags & 0x10)


def _prune_timestamp_map(entries, cutoff):
    for item, observed_at in list(entries.items()):
        if observed_at < cutoff:
            entries.pop(item, None)


def _cleanup_stale_trackers(now):
    """Bounds detector memory without scanning every tracker for every packet."""
    global _last_tracker_cleanup
    if now - _last_tracker_cleanup < TRACKER_CLEANUP_INTERVAL_SECONDS:
        return

    tracker_windows = (
        (port_scan_tracker, PORT_SCAN_WINDOW_SECONDS),
        (syn_flood_tracker, SYN_FLOOD_WINDOW_SECONDS),
        (ping_sweep_tracker, PING_SWEEP_WINDOW_SECONDS),
    )
    for tracker, window in tracker_windows:
        cutoff = now - window
        for key, entries in list(tracker.items()):
            _prune_timestamp_map(entries, cutoff)
            if not entries:
                tracker.pop(key, None)
    _last_tracker_cleanup = now


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

    tcp_layer = packet[TCP]
    if not _is_initial_syn(tcp_layer):
        return None

    src_ip = packet[IP].src
    dst_ip = packet[IP].dst
    dst_port = int(tcp_layer.dport)
    now = time()
    _cleanup_stale_trackers(now)

    key = (src_ip, dst_ip)
    recent_ports = port_scan_tracker[key]
    _prune_timestamp_map(recent_ports, now - PORT_SCAN_WINDOW_SECONDS)
    recent_ports[dst_port] = now

    if len(recent_ports) >= PORT_SCAN_THRESHOLD:
        recent_ports.clear()
        return build_alert(
            alert_type="PORT_SCAN",
            src_ip=src_ip,
            dst_ip=dst_ip,
            message=(
                f"{src_ip} attempted {PORT_SCAN_THRESHOLD}+ ports on {dst_ip} "
                f"within {PORT_SCAN_WINDOW_SECONDS}s — possible port scan"
            ),
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

    tcp_layer = packet[TCP]
    src_ip = packet[IP].src
    dst_ip = packet[IP].dst
    src_port = int(tcp_layer.sport)
    dst_port = int(tcp_layer.dport)
    now = time()
    _cleanup_stale_trackers(now)

    if not _is_initial_syn(tcp_layer):
        # A response or later packet proves the corresponding connection is not
        # an unresolved SYN attempt. Remove both possible packet directions.
        for flow_key, flow in (
            ((src_ip, dst_ip), (src_port, dst_port)),
            ((dst_ip, src_ip), (dst_port, src_port)),
        ):
            recent_flows = syn_flood_tracker.get(flow_key)
            if recent_flows is not None:
                recent_flows.pop(flow, None)
                if not recent_flows:
                    syn_flood_tracker.pop(flow_key, None)
        return None

    key = (src_ip, dst_ip)
    recent_flows = syn_flood_tracker[key]
    _prune_timestamp_map(recent_flows, now - SYN_FLOOD_WINDOW_SECONDS)
    recent_flows[(src_port, dst_port)] = now

    if len(recent_flows) >= SYN_FLOOD_THRESHOLD:
        recent_flows.clear()
        return build_alert(
            alert_type="SYN_FLOOD",
            src_ip=src_ip,
            dst_ip=dst_ip,
            message=(
                f"{src_ip} opened {SYN_FLOOD_THRESHOLD}+ unresolved SYN flows to {dst_ip} "
                f"within {SYN_FLOOD_WINDOW_SECONDS}s — possible SYN flood"
            ),
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
    now = time()
    _cleanup_stale_trackers(now)

    recent_hosts = ping_sweep_tracker[src_ip]
    _prune_timestamp_map(recent_hosts, now - PING_SWEEP_WINDOW_SECONDS)
    recent_hosts[dst_ip] = now

    if len(recent_hosts) >= PING_SWEEP_THRESHOLD:
        recent_hosts.clear()
        return build_alert(
            alert_type="PING_SWEEP",
            src_ip=src_ip,
            dst_ip=dst_ip,
            message=(
                f"{src_ip} pinged {PING_SWEEP_THRESHOLD}+ hosts within "
                f"{PING_SWEEP_WINDOW_SECONDS}s — possible ping sweep"
            ),
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

    now = time()
    claimed_ip = arp_layer.psrc
    claimed_mac = arp_layer.hwsrc.lower()
    observed_claim = arp_claim_tracker.get(claimed_ip)
    previous_mac = observed_claim["mac"] if observed_claim else None

    if previous_mac is None:
        arp_claim_tracker[claimed_ip] = {"mac": claimed_mac, "last_seen": now}
        return None

    if previous_mac == claimed_mac:
        arp_claim_tracker[claimed_ip]["last_seen"] = now
        return None

    if now - observed_claim["last_seen"] > ARP_ENTRY_TTL_SECONDS:
        arp_claim_tracker[claimed_ip] = {"mac": claimed_mac, "last_seen": now}
        return None

    conflict_key = (claimed_ip, previous_mac, claimed_mac)
    conflict_entry = arp_conflict_tracker.get(conflict_key, {"count": 0, "last_seen": now})
    conflict_entry["count"] += 1
    conflict_entry["last_seen"] = now
    arp_conflict_tracker[conflict_key] = conflict_entry

    if conflict_entry["count"] < ARP_SPOOF_CONFIRMATION_THRESHOLD:
        return None

    arp_claim_tracker[claimed_ip] = {"mac": claimed_mac, "last_seen": now}
    arp_conflict_tracker.pop(conflict_key, None)
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
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
