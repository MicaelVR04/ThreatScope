"""
alert_sender.py — Sends detected alerts to the ThreatScope API
"""
import requests
from dotenv import load_dotenv
import os

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:8000/alerts")
ENGINE_API_KEY = os.getenv("ENGINE_API_KEY", "").strip()

def send_alert(alert: dict):
    try:
        headers = {"X-Engine-Key": ENGINE_API_KEY} if ENGINE_API_KEY else {}
        response = requests.post(API_URL, json=alert, headers=headers, timeout=10)
        print(f"[ALERT SENT] {alert['type']} — status {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Could not reach API: {e}")
