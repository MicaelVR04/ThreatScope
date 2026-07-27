"""
alert_sender.py — Sends detected alerts to the ThreatScope API
"""
import os
import requests

from sensor_config import load_sensor_environment, sensor_auth_headers

load_sensor_environment()

API_URL = os.getenv("API_URL", "http://localhost:8000/alerts")

def send_alert(alert: dict):
    try:
        response = requests.post(
            API_URL,
            json=alert,
            headers=sensor_auth_headers(),
            timeout=10,
        )
        print(f"[ALERT SENT] {alert['type']} — status {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Could not reach API: {e}")
