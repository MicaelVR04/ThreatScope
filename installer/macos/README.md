# ThreatScope macOS Project Installer

This directory builds the ad-hoc-signed, no-Terminal installer used by the
Holberton project. End users download the resulting ZIP, open the app, paste a
one-time code, and approve the normal macOS administrator dialog.

## Security model

- The installer contains the public HTTPS API URL, never `ENGINE_API_KEY` or a
  Supabase key.
- Enrollment codes contain 192 bits of randomness, expire after ten minutes,
  are stored server-side only as SHA-256 hashes, and can be consumed once.
- Successful enrollment replaces the code with a unique 256-bit sensor token.
- The API stores only the token hash. The Mac stores the token in
  `/Library/Application Support/ThreatScope/sensor.env`, owned by `root:wheel`
  with mode `600`.
- Dashboard removal revokes the token immediately. Local removal attempts
  self-revocation, unloads the service, and deletes the credential.
- The helper accepts only HTTPS API URLs and validates all user-controlled
  values before privileged file operations.

The project build is ad-hoc signed, not Apple notarized. Users may need to
choose **Open Anyway** under **System Settings → Privacy & Security**. A public
release requires an Apple Developer ID Installer/Application certificate and
notarization.

## Build

Building is a project-team operation and may use Terminal. End-user setup does
not.

```bash
cd /path/to/ThreatScope
python3.11 -m venv .venv-installer
.venv-installer/bin/python -m pip install -r engine/requirements.txt -r installer/macos/requirements-build.txt
./installer/macos/build_installer.sh
```

Output:

```text
dist/installer/ThreatScope-Sensor-macOS.zip
```

The current build targets Apple Silicon Macs and macOS 13 or newer. Override
the embedded destinations only at build time:

```bash
THREATSCOPE_INSTALLER_API_URL=https://api.example.com \
THREATSCOPE_DASHBOARD_URL=https://dashboard.example.com/dashboard \
./installer/macos/build_installer.sh
```

Both URLs must use HTTPS. Publish the ZIP as a GitHub Release asset, then set
the dashboard's `VITE_SENSOR_INSTALLER_URL` to the asset's direct URL.

## Required Supabase migration

Run `supabase/sensor_enrollment_schema.sql` once in the project Supabase SQL
Editor. The tables and enrollment function are private to the API service role;
`anon` and `authenticated` receive no direct table or function access.
