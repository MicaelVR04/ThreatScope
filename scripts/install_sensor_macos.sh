#!/bin/sh
set -eu

LABEL="com.threatscope.sensor"
PLIST_PATH="/Library/LaunchDaemons/${LABEL}.plist"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
PYTHON_PATH="${PROJECT_ROOT}/.venv/bin/python"
TEMPLATE_PATH="${SCRIPT_DIR}/${LABEL}.plist.template"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer supports macOS only."
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer with sudo:"
  echo "  sudo ./scripts/install_sensor_macos.sh"
  exit 1
fi

if [ ! -x "${PYTHON_PATH}" ]; then
  echo "Missing project Python environment at ${PYTHON_PATH}"
  echo "Create the root .venv and install engine/requirements.txt first."
  exit 1
fi

if [ ! -f "${PROJECT_ROOT}/.env" ]; then
  echo "Missing ${PROJECT_ROOT}/.env"
  exit 1
fi

if ! grep -Eq '^ENGINE_API_KEY=.+$' "${PROJECT_ROOT}/.env"; then
  echo "ENGINE_API_KEY must be configured in ${PROJECT_ROOT}/.env"
  exit 1
fi

escaped_root="$(printf '%s' "${PROJECT_ROOT}" | sed 's/[&|]/\\&/g')"
escaped_python="$(printf '%s' "${PYTHON_PATH}" | sed 's/[&|]/\\&/g')"

sed \
  -e "s|__PROJECT_ROOT__|${escaped_root}|g" \
  -e "s|__PYTHON_PATH__|${escaped_python}|g" \
  "${TEMPLATE_PATH}" > "${PLIST_PATH}"

chown root:wheel "${PLIST_PATH}"
chmod 644 "${PLIST_PATH}"

launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap system "${PLIST_PATH}"
launchctl enable "system/${LABEL}"
launchctl kickstart -k "system/${LABEL}"

echo "ThreatScope sensor installed and started."
echo "Status: sudo launchctl print system/${LABEL}"
echo "Logs:   sudo tail -f /var/log/threatscope-sensor.log"
