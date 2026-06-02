"""
test_rules.py — Unit tests for ThreatScope detection rules
Person 1 owns this file.

Run with:
    cd engine
    python -m pytest tests/ -v

Tests cover:
    - Port scan detection
    - SYN flood detection
    - Ping sweep detection
    - Clean packet handling (no false positives)
    - Severity scoring
    - Alert structure validation
"""

import sys
import os

# Make sure Python can find the engine modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import rules
from scapy.all import ARP, IP, TCP, ICMP, Ether
from rules import (
    analyze_packet,
    detect_arp_spoof,
    detect_port_scan,
    detect_syn_flood,
    detect_ping_sweep,
    arp_claim_tracker,
    arp_conflict_tracker,
    packet_allowed,
    port_scan_tracker,
    syn_flood_tracker,
    ping_sweep_tracker,
    alert_cooldowns,
    PORT_SCAN_THRESHOLD,
    SYN_FLOOD_THRESHOLD,
    PING_SWEEP_THRESHOLD,
)
from severity import score_severity, is_higher_severity


# ── Helpers ────────────────────────────────────────────────────────────────

def make_tcp_packet(src_ip, dst_ip, dst_port, flags=0x02):
    """Creates a TCP packet with the given parameters."""
    return IP(src=src_ip, dst=dst_ip) / TCP(dport=dst_port, flags=flags)

def make_icmp_packet(src_ip, dst_ip, icmp_type=8):
    """Creates an ICMP packet with the given parameters."""
    return IP(src=src_ip, dst=dst_ip) / ICMP(type=icmp_type)

def make_arp_reply(claimed_ip, claimed_mac, target_ip="192.168.1.1", target_mac="ff:ff:ff:ff:ff:ff"):
    """Creates an ARP reply packet with a claimed IP/MAC mapping."""
    return Ether(src=claimed_mac, dst=target_mac) / ARP(
        op=2,
        psrc=claimed_ip,
        pdst=target_ip,
        hwsrc=claimed_mac,
        hwdst=target_mac,
    )

def clear_trackers():
    """Resets all detection trackers between tests."""
    arp_claim_tracker.clear()
    arp_conflict_tracker.clear()
    port_scan_tracker.clear()
    syn_flood_tracker.clear()
    ping_sweep_tracker.clear()
    alert_cooldowns.clear()


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_trackers():
    """Automatically clears trackers before every test."""
    clear_trackers()
    yield
    clear_trackers()


# ── Port Scan Tests ────────────────────────────────────────────────────────

class TestPortScan:

    def test_no_alert_below_threshold(self):
        """Should NOT alert when ports scanned is below the threshold."""
        src_ip = "192.168.1.10"
        for port in range(1, PORT_SCAN_THRESHOLD):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)
            assert alert is None, f"False positive on port {port}"

    def test_alert_at_threshold(self):
        """SHOULD alert when unique ports hit the threshold."""
        src_ip = "192.168.1.10"
        alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)
        assert alert is not None, "Expected PORT_SCAN alert but got None"

    def test_alert_type_is_correct(self):
        """Alert type should be PORT_SCAN."""
        src_ip = "192.168.1.10"
        alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)
        assert alert["type"] == "PORT_SCAN"

    def test_alert_severity_is_medium(self):
        """Port scan severity should be MEDIUM."""
        src_ip = "192.168.1.10"
        alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)
        assert alert["severity"] == "MEDIUM"

    def test_alert_contains_src_ip(self):
        """Alert should contain the correct source IP."""
        src_ip = "192.168.1.55"
        alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)
        assert alert["src_ip"] == src_ip

    def test_no_alert_for_repeated_same_port(self):
        """Hitting the same port many times should NOT trigger a port scan alert."""
        src_ip = "192.168.1.10"
        for _ in range(PORT_SCAN_THRESHOLD + 10):
            packet = make_tcp_packet(src_ip, "10.0.0.1", 80)
            alert = detect_port_scan(packet)
        assert alert is None, "Same port repeated should not trigger port scan"

    def test_no_alert_for_non_tcp_packet(self):
        """ICMP packets should NOT trigger port scan detection."""
        src_ip = "192.168.1.10"
        for i in range(PORT_SCAN_THRESHOLD + 5):
            packet = make_icmp_packet(src_ip, "10.0.0.1")
            alert = detect_port_scan(packet)
        assert alert is None


# ── SYN Flood Tests ────────────────────────────────────────────────────────

class TestSynFlood:

    def test_no_alert_below_threshold(self):
        """Should NOT alert when SYN count is below the threshold."""
        src_ip = "10.0.0.5"
        for _ in range(SYN_FLOOD_THRESHOLD - 1):
            packet = make_tcp_packet(src_ip, "192.168.1.1", 80, flags=0x02)
            alert = detect_syn_flood(packet)
        assert alert is None

    def test_alert_at_threshold(self):
        """SHOULD alert when SYN packets hit the threshold."""
        src_ip = "10.0.0.5"
        alert = None
        for _ in range(SYN_FLOOD_THRESHOLD):
            packet = make_tcp_packet(src_ip, "192.168.1.1", 80, flags=0x02)
            alert = detect_syn_flood(packet)
        assert alert is not None, "Expected SYN_FLOOD alert but got None"

    def test_alert_type_is_correct(self):
        """Alert type should be SYN_FLOOD."""
        src_ip = "10.0.0.5"
        alert = None
        for _ in range(SYN_FLOOD_THRESHOLD):
            packet = make_tcp_packet(src_ip, "192.168.1.1", 80, flags=0x02)
            alert = detect_syn_flood(packet)
        assert alert["type"] == "SYN_FLOOD"

    def test_alert_severity_is_high(self):
        """SYN flood severity should be HIGH."""
        src_ip = "10.0.0.5"
        alert = None
        for _ in range(SYN_FLOOD_THRESHOLD):
            packet = make_tcp_packet(src_ip, "192.168.1.1", 80, flags=0x02)
            alert = detect_syn_flood(packet)
        assert alert["severity"] == "HIGH"

    def test_no_alert_for_non_syn_packets(self):
        """ACK packets should NOT trigger SYN flood detection."""
        src_ip = "10.0.0.5"
        for _ in range(SYN_FLOOD_THRESHOLD + 10):
            packet = make_tcp_packet(src_ip, "192.168.1.1", 80, flags=0x10)  # ACK flag
            alert = detect_syn_flood(packet)
        assert alert is None


# ── Ping Sweep Tests ───────────────────────────────────────────────────────

class TestPingSweep:

    def test_no_alert_below_threshold(self):
        """Should NOT alert when unique IPs pinged is below the threshold."""
        src_ip = "172.16.0.1"
        for i in range(1, PING_SWEEP_THRESHOLD):
            packet = make_icmp_packet(src_ip, f"192.168.1.{i}")
            alert = detect_ping_sweep(packet)
        assert alert is None

    def test_alert_at_threshold(self):
        """SHOULD alert when unique IPs pinged hits the threshold."""
        src_ip = "172.16.0.1"
        alert = None
        for i in range(1, PING_SWEEP_THRESHOLD + 1):
            packet = make_icmp_packet(src_ip, f"192.168.1.{i}")
            alert = detect_ping_sweep(packet)
        assert alert is not None, "Expected PING_SWEEP alert but got None"

    def test_alert_type_is_correct(self):
        """Alert type should be PING_SWEEP."""
        src_ip = "172.16.0.1"
        alert = None
        for i in range(1, PING_SWEEP_THRESHOLD + 1):
            packet = make_icmp_packet(src_ip, f"192.168.1.{i}")
            alert = detect_ping_sweep(packet)
        assert alert["type"] == "PING_SWEEP"

    def test_alert_severity_is_low(self):
        """Ping sweep severity should be LOW."""
        src_ip = "172.16.0.1"
        alert = None
        for i in range(1, PING_SWEEP_THRESHOLD + 1):
            packet = make_icmp_packet(src_ip, f"192.168.1.{i}")
            alert = detect_ping_sweep(packet)
        assert alert["severity"] == "LOW"

    def test_no_alert_for_repeated_same_ip(self):
        """Pinging the same IP many times should NOT trigger a ping sweep."""
        src_ip = "172.16.0.1"
        for _ in range(PING_SWEEP_THRESHOLD + 10):
            packet = make_icmp_packet(src_ip, "192.168.1.1")
            alert = detect_ping_sweep(packet)
        assert alert is None

    def test_no_alert_for_icmp_reply(self):
        """ICMP reply packets (type 0) should NOT trigger ping sweep detection."""
        src_ip = "172.16.0.1"
        for i in range(1, PING_SWEEP_THRESHOLD + 1):
            packet = make_icmp_packet(src_ip, f"192.168.1.{i}", icmp_type=0)
            alert = detect_ping_sweep(packet)
        assert alert is None


# ── Alert Structure Tests ──────────────────────────────────────────────────

class TestAlertStructure:

    def test_alert_has_all_required_fields(self):
        """Every alert should have all required fields."""
        src_ip = "192.168.1.10"
        alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)

        required_fields = ["type", "src_ip", "dst_ip", "severity", "message", "timestamp"]
        for field in required_fields:
            assert field in alert, f"Alert missing field: {field}"

    def test_alert_severity_is_valid(self):
        """Severity should always be LOW, MEDIUM, or HIGH."""
        src_ip = "192.168.1.10"
        alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            packet = make_tcp_packet(src_ip, "10.0.0.1", port)
            alert = detect_port_scan(packet)

        assert alert["severity"] in ["LOW", "MEDIUM", "HIGH"]


class TestArpSpoof:

    @pytest.fixture(autouse=True)
    def restore_arp_settings(self):
        original_ttl = rules.ARP_ENTRY_TTL_SECONDS
        original_threshold = rules.ARP_SPOOF_CONFIRMATION_THRESHOLD
        yield
        rules.ARP_ENTRY_TTL_SECONDS = original_ttl
        rules.ARP_SPOOF_CONFIRMATION_THRESHOLD = original_threshold

    def test_first_arp_claim_does_not_alert(self):
        packet = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:01")
        assert detect_arp_spoof(packet) is None

    def test_same_mac_repeat_does_not_alert(self):
        first = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:01")
        second = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:01")
        detect_arp_spoof(first)
        assert detect_arp_spoof(second) is None

    def test_mac_change_triggers_arp_spoof_alert(self):
        rules.ARP_SPOOF_CONFIRMATION_THRESHOLD = 2
        first = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:01")
        second = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:02")
        third = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:02")
        detect_arp_spoof(first)
        assert detect_arp_spoof(second) is None
        alert = detect_arp_spoof(third)
        assert alert is not None
        assert alert["type"] == "ARP_SPOOF"
        assert alert["severity"] == "MEDIUM"

    def test_stale_mapping_change_does_not_alert(self, monkeypatch):
        rules.ARP_ENTRY_TTL_SECONDS = 1
        times = iter([100.0, 102.0])
        monkeypatch.setattr(rules, "time", lambda: next(times))

        first = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:01")
        second = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:02")
        assert detect_arp_spoof(first) is None
        assert detect_arp_spoof(second) is None

    def test_analyze_packet_supports_arp_spoof(self):
        rules.DEMO_MODE = True
        rules.ALLOWED_SUBNETS = []
        rules.ARP_SPOOF_CONFIRMATION_THRESHOLD = 2
        first = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:01")
        second = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:02")
        third = make_arp_reply("192.168.1.50", "aa:bb:cc:dd:ee:02")
        assert analyze_packet(first) is None
        assert analyze_packet(second) is None
        alert = analyze_packet(third)
        assert alert is not None
        assert alert["type"] == "ARP_SPOOF"


class TestDemoStability:

    @pytest.fixture(autouse=True)
    def restore_demo_settings(self):
        original_demo_mode = rules.DEMO_MODE
        original_allowed_subnets = list(rules.ALLOWED_SUBNETS)
        yield
        rules.DEMO_MODE = original_demo_mode
        rules.ALLOWED_SUBNETS = original_allowed_subnets

    def test_packet_allowed_for_private_traffic(self):
        rules.DEMO_MODE = True
        rules.ALLOWED_SUBNETS = []
        packet = make_tcp_packet("192.168.1.10", "10.0.0.1", 80)
        assert packet_allowed(packet) is True

    def test_packet_blocked_for_public_traffic(self):
        rules.DEMO_MODE = True
        rules.ALLOWED_SUBNETS = []
        packet = make_tcp_packet("8.8.8.8", "1.1.1.1", 80)
        assert packet_allowed(packet) is False

    def test_packet_allowed_for_public_traffic_outside_demo_mode(self):
        rules.DEMO_MODE = False
        rules.ALLOWED_SUBNETS = []
        packet = make_tcp_packet("8.8.8.8", "1.1.1.1", 80)
        assert packet_allowed(packet) is True

    def test_duplicate_port_scan_alert_is_suppressed_by_cooldown(self):
        rules.DEMO_MODE = True
        rules.ALLOWED_SUBNETS = []
        src_ip = "192.168.1.10"

        first_alert = None
        for port in range(1, PORT_SCAN_THRESHOLD + 1):
            first_alert = detect_port_scan(make_tcp_packet(src_ip, "10.0.0.1", port))

        second_alert = None
        for port in range(100, 100 + PORT_SCAN_THRESHOLD):
            second_alert = detect_port_scan(make_tcp_packet(src_ip, "10.0.0.1", port))

        assert first_alert is not None
        assert second_alert is None

    def test_clean_packet_returns_none(self):
        """A normal TCP packet should return None from analyze_packet."""
        packet = make_tcp_packet("192.168.1.1", "10.0.0.1", 80, flags=0x10)
        alert = analyze_packet(packet)
        assert alert is None


# ── Severity Tests ─────────────────────────────────────────────────────────

class TestSeverity:

    def test_syn_flood_is_high(self):
        assert score_severity("SYN_FLOOD") == "HIGH"

    def test_port_scan_is_medium(self):
        assert score_severity("PORT_SCAN") == "MEDIUM"

    def test_ping_sweep_is_low(self):
        assert score_severity("PING_SWEEP") == "LOW"

    def test_unknown_type_defaults_to_low(self):
        assert score_severity("UNKNOWN_ATTACK") == "LOW"

    def test_high_is_higher_than_medium(self):
        assert is_higher_severity("HIGH", "MEDIUM") is True

    def test_medium_is_higher_than_low(self):
        assert is_higher_severity("MEDIUM", "LOW") is True

    def test_low_is_not_higher_than_high(self):
        assert is_higher_severity("LOW", "HIGH") is False

    def test_same_severity_is_not_higher(self):
        assert is_higher_severity("HIGH", "HIGH") is False
