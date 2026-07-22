#!/bin/sh
set -eu

LABEL="com.threatscope.sensor"
INSTALL_DIR="/Library/Application Support/ThreatScope"
SENSOR_PATH="${INSTALL_DIR}/threatscope-sensor"
CONFIG_PATH="${INSTALL_DIR}/sensor.env"
PLIST_PATH="/Library/LaunchDaemons/${LABEL}.plist"
ACTION="${1:-}"
SOURCE_SENSOR="${2:-}"
API_BASE_URL="${3:-}"
CODE_FILE="${4:-}"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail "Administrator approval is required."
[ "$(uname -s)" = "Darwin" ] || fail "This installer currently supports macOS only."

remove_local_sensor() {
  launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
  rm -f "${PLIST_PATH}"
  rm -rf "${INSTALL_DIR}"
}

revoke_local_sensor() {
  [ -f "${CONFIG_PATH}" ] || return 0
  STORED_API="$(awk -F= '$1 == "API_BASE_URL" {print substr($0, index($0, "=") + 1); exit}' "${CONFIG_PATH}")"
  STORED_TOKEN="$(awk -F= '$1 == "SENSOR_TOKEN" {print substr($0, index($0, "=") + 1); exit}' "${CONFIG_PATH}")"
  if printf '%s' "${STORED_API}" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$' \
    && printf '%s' "${STORED_TOKEN}" | grep -Eq '^ts1\.[0-9a-fA-F-]{36}\.[A-Za-z0-9_-]{32,64}$'; then
    CURL_CONFIG="$(mktemp -t threatscope-revoke)" || return 0
    chmod 600 "${CURL_CONFIG}"
    printf 'header = "X-Sensor-Token: %s"\n' "${STORED_TOKEN}" > "${CURL_CONFIG}"
    /usr/bin/curl --config "${CURL_CONFIG}" --silent --show-error --fail --max-time 10 \
      -X DELETE "${STORED_API}/sensors/self" >/dev/null 2>&1 || true
    rm -f "${CURL_CONFIG}"
  fi
}

cleanup_failed_install() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "${INSTALL_COMPLETE:-0}" -ne 1 ]; then
    revoke_local_sensor
    remove_local_sensor
  fi
  exit "${status}"
}

case "${ACTION}" in
  install)
    [ -f "${SOURCE_SENSOR}" ] && [ ! -L "${SOURCE_SENSOR}" ] && [ -x "${SOURCE_SENSOR}" ] \
      || fail "The sensor file is missing or unsafe. Download the setup app again."
    case "${API_BASE_URL}" in
      https://*) ;;
      *) fail "The installer refused a non-HTTPS server address." ;;
    esac
    printf '%s' "${API_BASE_URL}" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$' \
      || fail "The installer refused an invalid server address."
    [ ! -L "${INSTALL_DIR}" ] || fail "The installation folder is not safe to use."
    [ -f "${CODE_FILE}" ] && [ ! -L "${CODE_FILE}" ] \
      || fail "The installation code could not be read safely."
    ENROLLMENT_CODE="$(tr -d '\r\n' < "${CODE_FILE}")"
    printf '%s' "${ENROLLMENT_CODE}" | grep -Eq '^[A-Za-z0-9_-]{32,64}$' \
      || fail "The installation code format is not valid."

    INSTALL_COMPLETE=0
    trap cleanup_failed_install EXIT
    trap 'exit 1' HUP INT TERM
    umask 077
    launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
    mkdir -p "${INSTALL_DIR}"
    chown root:wheel "${INSTALL_DIR}"
    chmod 755 "${INSTALL_DIR}"
    rm -f "${SENSOR_PATH}" "${CONFIG_PATH}" "${PLIST_PATH}"
    cp "${SOURCE_SENSOR}" "${SENSOR_PATH}"
    chown root:wheel "${SENSOR_PATH}"
    chmod 755 "${SENSOR_PATH}"

    {
      printf 'API_BASE_URL=%s\n' "${API_BASE_URL}"
      printf 'API_URL=%s/alerts\n' "${API_BASE_URL}"
      printf 'SENSOR_ENROLLMENT_CODE=%s\n' "${ENROLLMENT_CODE}"
      printf 'SENSOR_HEARTBEAT_INTERVAL_SECONDS=5\n'
      printf 'MONITORING_DEFAULT_ENABLED=true\n'
    } > "${CONFIG_PATH}"
    chown root:wheel "${CONFIG_PATH}"
    chmod 600 "${CONFIG_PATH}"

    cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${SENSOR_PATH}</string></array>
  <key>WorkingDirectory</key><string>${INSTALL_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONUNBUFFERED</key><string>1</string>
    <key>THREATSCOPE_CONFIG_PATH</key><string>${CONFIG_PATH}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>/var/log/threatscope-sensor.log</string>
  <key>StandardErrorPath</key><string>/var/log/threatscope-sensor-error.log</string>
</dict>
</plist>
PLIST
    chown root:wheel "${PLIST_PATH}"
    chmod 644 "${PLIST_PATH}"

    launchctl bootout system "${PLIST_PATH}" >/dev/null 2>&1 || true
    launchctl enable "system/${LABEL}"
    launchctl bootstrap system "${PLIST_PATH}"

    attempts=0
    while [ "${attempts}" -lt 45 ]; do
      if grep -Eq '^SENSOR_TOKEN=ts1\.' "${CONFIG_PATH}"; then
        INSTALL_COMPLETE=1
        trap - EXIT HUP INT TERM
        printf 'Sensor connected successfully. Return to the dashboard to confirm live monitoring.\n'
        exit 0
      fi
      attempts=$((attempts + 1))
      sleep 1
    done

    fail "The sensor could not connect. Generate a new code and try again."
    ;;
  remove)
    revoke_local_sensor
    remove_local_sensor
    printf 'Sensor removed from this Mac. You can also remove its access record from the dashboard.\n'
    ;;
  *)
    fail "Unknown installer action."
    ;;
esac
