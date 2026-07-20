#!/bin/sh
set -eu

LABEL="com.threatscope.sensor"
PLIST_PATH="/Library/LaunchDaemons/${LABEL}.plist"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this uninstaller with sudo:"
  echo "  sudo ./scripts/uninstall_sensor_macos.sh"
  exit 1
fi

if [ -f "${PLIST_PATH}" ]; then
  launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
  rm "${PLIST_PATH}"
fi

echo "ThreatScope sensor service removed."
