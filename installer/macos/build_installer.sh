#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/../.." && pwd)"
PYTHON="${THREATSCOPE_BUILD_PYTHON:-${PROJECT_ROOT}/.venv-installer/bin/python}"
OUTPUT_DIR="${PROJECT_ROOT}/dist/installer"
BUILD_DIR="${PROJECT_ROOT}/build/installer"
APP_NAME="ThreatScope Sensor Setup"
APP_DIR="${OUTPUT_DIR}/${APP_NAME}.app"
API_BASE_URL="${THREATSCOPE_INSTALLER_API_URL:-https://threatscope-api.onrender.com}"
DASHBOARD_URL="${THREATSCOPE_DASHBOARD_URL:-https://threatscope-dashboard.onrender.com/dashboard}"

[ "$(uname -s)" = "Darwin" ] || { echo "The macOS installer must be built on macOS."; exit 1; }
[ -x "${PYTHON}" ] || { echo "Missing installer build environment at ${PYTHON}"; exit 1; }
"${PYTHON}" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' \
  || { echo "The installer must be built with Python 3.11 or newer."; exit 1; }
"${PYTHON}" -m PyInstaller --version >/dev/null 2>&1 || {
  echo "Install build dependencies first: ${PYTHON} -m pip install -r installer/macos/requirements-build.txt"
  exit 1
}

case "${API_BASE_URL}" in
  https://*) ;;
  *) echo "THREATSCOPE_INSTALLER_API_URL must use HTTPS."; exit 1 ;;
esac
printf '%s' "${API_BASE_URL}" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$' \
  || { echo "THREATSCOPE_INSTALLER_API_URL contains unsupported characters."; exit 1; }
printf '%s' "${DASHBOARD_URL}" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/%-]*)?$' \
  || { echo "THREATSCOPE_DASHBOARD_URL must be a valid HTTPS URL."; exit 1; }

rm -rf "${BUILD_DIR}" "${OUTPUT_DIR}"
mkdir -p "${BUILD_DIR}" "${OUTPUT_DIR}"

"${PYTHON}" -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --name threatscope-sensor \
  --distpath "${BUILD_DIR}/sensor-dist" \
  --workpath "${BUILD_DIR}/sensor-work" \
  --specpath "${BUILD_DIR}" \
  --paths "${PROJECT_ROOT}/engine" \
  "${PROJECT_ROOT}/engine/sensor.py"

sed \
  -e "s|__API_BASE_URL__|${API_BASE_URL}|g" \
  -e "s|__DASHBOARD_URL__|${DASHBOARD_URL}|g" \
  "${SCRIPT_DIR}/ThreatScopeInstaller.applescript" > "${BUILD_DIR}/ThreatScopeInstaller.applescript"

/usr/bin/osacompile -o "${APP_DIR}" "${BUILD_DIR}/ThreatScopeInstaller.applescript"
mkdir -p "${APP_DIR}/Contents/Resources"

cp "${BUILD_DIR}/sensor-dist/threatscope-sensor" "${APP_DIR}/Contents/Resources/threatscope-sensor"
cp "${SCRIPT_DIR}/install_helper.sh" "${APP_DIR}/Contents/Resources/install_helper.sh"
chmod 755 "${APP_DIR}/Contents/Resources/threatscope-sensor" \
  "${APP_DIR}/Contents/Resources/install_helper.sh"

/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.threatscope.sensor-setup" "${APP_DIR}/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName ${APP_NAME}" "${APP_DIR}/Contents/Info.plist"
for key in NSAppleMusicUsageDescription NSCalendarsUsageDescription NSCameraUsageDescription \
  NSContactsUsageDescription NSHomeKitUsageDescription NSMicrophoneUsageDescription \
  NSPhotoLibraryUsageDescription NSRemindersUsageDescription NSSiriUsageDescription; do
  /usr/libexec/PlistBuddy -c "Delete :${key}" "${APP_DIR}/Contents/Info.plist" >/dev/null 2>&1 || true
done
/usr/bin/codesign --force --deep --sign - --identifier com.threatscope.sensor-setup "${APP_DIR}"

/usr/bin/ditto -c -k --sequesterRsrc --keepParent "${APP_DIR}" "${OUTPUT_DIR}/ThreatScope-Sensor-macOS.zip"
echo "Built ${OUTPUT_DIR}/ThreatScope-Sensor-macOS.zip"
