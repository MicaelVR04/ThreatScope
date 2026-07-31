"""
simulate.py — Simulates the detection engine sending alerts to the API
Run with: python simulate.py
"""

import requests
import os
import time
import random
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API_URL = "http://localhost:8000/alerts"
ENGINE_API_KEY = os.getenv("ENGINE_API_KEY", "").strip()

ATTACKS = [
    {
        "type": "PORT_SCAN",
        "severity": "MEDIUM",
        "message": "Port scan detected — 1000 ports scanned in 2 seconds"
    },
    {
        "type": "SYN_FLOOD",
        "severity": "HIGH",
        "message": "SYN flood detected — 500 SYN packets with no ACK"
    },
    {
        "type": "PING_SWEEP",
        "severity": "LOW",
        "message": "Ping sweep detected — 254 hosts pinged sequentially"
    },
    {
        "type": "ARP_SPOOF",
        "severity": "MEDIUM",
        "message": "ARP spoofing detected — duplicate MAC address"
    },
]

def send_alert(attack):
    payload = {
        "type": attack["type"],
        "src_ip": f"192.168.1.{random.randint(1, 254)}",
        "dst_ip": "192.168.1.1",
        "severity": attack["severity"],
        "message": attack["message"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        headers = {"X-Engine-Key": ENGINE_API_KEY} if ENGINE_API_KEY else {}
        response = requests.post(API_URL, json=payload, headers=headers, timeout=10)
        print(f"[{payload['severity']}] {payload['type']} from {payload['src_ip']} — status {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Could not reach API: {e}")

def simulate(count=10, delay=1.5):
    print(f"Simulating {count} attacks...\n")
    for i in range(count):
        attack = random.choice(ATTACKS)
        send_alert(attack)
        time.sleep(delay)
    print("\nSimulation complete.")

if __name__ == "__main__":
    simulate()
