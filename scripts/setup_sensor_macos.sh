#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
VENV_PATH="${PROJECT_ROOT}/.venv"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "ThreatScope's guided sensor setup currently supports macOS only."
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this setup command without sudo. It will request your password when needed."
  exit 1
fi

if [ ! -f "${PROJECT_ROOT}/.env" ]; then
  echo "Missing ${PROJECT_ROOT}/.env"
  echo "Create it from .env.example and add the API URL and one-time enrollment code first."
  exit 1
fi

PYTHON_BIN="$(command -v python3.11 || command -v python3 || true)"
if [ -z "${PYTHON_BIN}" ] || ! "${PYTHON_BIN}" -c 'import sys; raise SystemExit(sys.version_info < (3, 10))'; then
  echo "ThreatScope requires Python 3.10 or newer (Python 3.11 recommended)."
  exit 1
fi

for key in API_URL API_BASE_URL SENSOR_ENROLLMENT_CODE; do
  if ! grep -Eq "^${key}=.+$" "${PROJECT_ROOT}/.env"; then
    echo "${key} must be configured in ${PROJECT_ROOT}/.env"
    exit 1
  fi
done

if [ ! -x "${VENV_PATH}/bin/python" ]; then
  echo "Creating the ThreatScope Python environment..."
  "${PYTHON_BIN}" -m venv "${VENV_PATH}"
fi

if ! "${VENV_PATH}/bin/python" -c 'import sys; raise SystemExit(sys.version_info < (3, 10))'; then
  echo "The existing ${VENV_PATH} uses an unsupported Python version. Remove it and run setup again."
  exit 1
fi

echo "Installing sensor dependencies..."
"${VENV_PATH}/bin/python" -m pip install -r "${PROJECT_ROOT}/engine/requirements.txt"

echo "Registering the macOS background service..."
sudo "${SCRIPT_DIR}/install_sensor_macos.sh"
