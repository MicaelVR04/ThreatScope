# ThreatScope Windows Project Installer

This package provides a no-Terminal, project-preview setup flow for Windows 10
and 11. Extract the ZIP and double-click **Start ThreatScope Sensor Setup**.
The setup opens a guided window, asks for the normal Windows administrator
approval, and uses a short-lived enrollment code from the dashboard.

## Prerequisites

- Windows 10 or 11
- Python 3.11 from [python.org](https://www.python.org/downloads/windows/)
- Npcap from [npcap.com](https://npcap.com/#download)
- An internet connection for the first dependency installation

The installer checks for Python and Npcap before it accepts an enrollment code.
It opens only the official prerequisite pages. Do not disable Microsoft Defender
or Windows security to run this project-preview package.

## Security model

- The package includes the public HTTPS API URL, never `ENGINE_API_KEY` or a
  Supabase key.
- One-time enrollment codes are short-lived, server-side hashed, and consumed
  once. Setup exchanges a code for a per-sensor token.
- The token is stored at `C:\ProgramData\ThreatScope\sensor.env` with an ACL
  restricted to `SYSTEM` and local Administrators.
- The sensor runs as the `ThreatScopeSensor` Scheduled Task under `SYSTEM` so
  it restarts after Windows boots. The dashboard can pause monitoring and
  revoke the sensor at any time.
- Setup installs and verifies a replacement sensor before it revokes the old
  credential. If replacement cannot connect, it leaves the prior server-side
  registration intact so setup can be retried safely.

## Build a release package

Run this on Windows from a clean checkout after updating the API URL in
`install_helper.ps1` if staging changes:

```powershell
Set-Location C:\path\to\ThreatScope
Compress-Archive -Path installer\windows\* -DestinationPath dist\installer\ThreatScope-Sensor-Windows.zip -Force
```

For the dashboard bundle, include `engine\*.py` and `engine\requirements.txt`
alongside the setup files. The repository script `build_installer.ps1` creates
that exact layout.

## Public-release gap

This is an unsigned Demo Day package. A public release requires an Authenticode
code-signing certificate, a Windows build/release pipeline, dependency artifact
pinning, and a signed installer such as MSIX or MSI.
