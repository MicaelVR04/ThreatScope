"""
demo_traffic.py — deterministic demo trigger for ThreatScope

Runs the real detection path without relying on ambient venue traffic:
crafted packets -> rules engine -> alert sender -> API -> dashboard
"""

import argparse
import os
import sys
import time

from dotenv import load_dotenv
from scapy.all import ICMP, IP, TCP

from capture import handle_packet

load_dotenv()

DEFAULT_SRC_IP = os.getenv("DEMO_SRC_IP", "192.168.99.50")
DEFAULT_DST_IP = os.getenv("DEMO_DST_IP", "192.168.99.10")


def trigger_port_scan(src_ip: str, dst_ip: str):
    for port in range(20, 30):
        handle_packet(IP(src=src_ip, dst=dst_ip) / TCP(dport=port, flags=0x02))
        time.sleep(0.05)


def trigger_ping_sweep(src_ip: str, dst_prefix: str):
    for host in range(1, 6):
        handle_packet(IP(src=src_ip, dst=f"{dst_prefix}.{host}") / ICMP(type=8))
        time.sleep(0.05)


def trigger_syn_flood(src_ip: str, dst_ip: str):
    for _ in range(100):
        handle_packet(IP(src=src_ip, dst=dst_ip) / TCP(dport=80, flags=0x02))


def main():
    parser = argparse.ArgumentParser(description="Trigger deterministic ThreatScope demo alerts.")
    parser.add_argument(
        "scenario",
        choices=["port-scan", "ping-sweep", "syn-flood"],
        help="Alert scenario to trigger.",
    )
    parser.add_argument("--src-ip", default=DEFAULT_SRC_IP, help="Spoofed source IP used in crafted packets.")
    parser.add_argument("--dst-ip", default=DEFAULT_DST_IP, help="Destination IP for port-scan or syn-flood.")
    parser.add_argument(
        "--dst-prefix",
        default="192.168.99",
        help="Destination prefix for ping-sweep, e.g. 192.168.99",
    )
    args = parser.parse_args()

    if args.scenario == "port-scan":
        trigger_port_scan(args.src_ip, args.dst_ip)
    elif args.scenario == "ping-sweep":
        trigger_ping_sweep(args.src_ip, args.dst_prefix)
    else:
        trigger_syn_flood(args.src_ip, args.dst_ip)

    print(f"Triggered {args.scenario} from {args.src_ip}")


if __name__ == "__main__":
    sys.exit(main())
