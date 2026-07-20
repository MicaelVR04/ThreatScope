#!/bin/sh
set -eu

LABEL="com.threatscope.sensor"
PLIST_PATH="/Library/LaunchDaemons/${LABEL}.plist"
ACTION="${1:-}"

usage() {
  echo "Usage: sudo ./scripts/control_sensor_macos.sh {status|start|stop|disable|enable|restart}"
}

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This control script supports macOS only."
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this command with sudo."
  usage
  exit 1
fi

case "${ACTION}" in
  status)
    launchctl print "system/${LABEL}"
    ;;
  start|enable)
    if [ ! -f "${PLIST_PATH}" ]; then
      echo "ThreatScope is not installed. Run sudo ./scripts/install_sensor_macos.sh first."
      exit 1
    fi
    launchctl enable "system/${LABEL}"
    launchctl bootstrap system "${PLIST_PATH}" >/dev/null 2>&1 || true
    launchctl kickstart -k "system/${LABEL}"
    echo "ThreatScope sensor enabled and started."
    ;;
  stop)
    launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
    echo "ThreatScope sensor stopped until it is started again or macOS reloads it."
    ;;
  disable)
    launchctl disable "system/${LABEL}"
    launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
    echo "ThreatScope sensor disabled. It will not start automatically."
    ;;
  restart)
    if [ ! -f "${PLIST_PATH}" ]; then
      echo "ThreatScope is not installed. Run sudo ./scripts/install_sensor_macos.sh first."
      exit 1
    fi
    launchctl enable "system/${LABEL}"
    launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
    launchctl bootstrap system "${PLIST_PATH}"
    launchctl kickstart -k "system/${LABEL}"
    echo "ThreatScope sensor restarted."
    ;;
  *)
    usage
    exit 1
    ;;
esac
