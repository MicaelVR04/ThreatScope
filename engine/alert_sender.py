"""
alert_sender.py — Sends detected alerts to the ThreatScope API
"""
import logging
import requests
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

API_URL = os.getenv("API_URL", "http://localhost:8000/alerts")
REQUEST_TIMEOUT = int(os.getenv("API_REQUEST_TIMEOUT", "5"))

def send_alert(alert: dict):
    try:
        response = requests.post(API_URL, json=alert, timeout=REQUEST_TIMEOUT)
        logger.info(f"[ALERT SENT] {alert['type']} — status {response.status_code}")
    except requests.exceptions.Timeout:
        logger.error(f"[ERROR] Request to API timed out after {REQUEST_TIMEOUT}s")
    except Exception as e:
        logger.error(f"[ERROR] Could not reach API: {e}")
