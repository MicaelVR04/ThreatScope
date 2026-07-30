[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Install', 'Remove')]
    [string]$Action,
    [string]$EnrollmentCode
)

$ErrorActionPreference = 'Stop'
$ApiBaseUrl = 'https://threatscope-api.onrender.com'
$InstallRoot = Join-Path $env:ProgramFiles 'ThreatScope'
$DataRoot = Join-Path $env:ProgramData 'ThreatScope'
$ConfigPath = Join-Path $DataRoot 'sensor.env'
$TaskName = 'ThreatScopeSensor'
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Set-PrivateDirectory([string]$Path) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $system = New-Object System.Security.AccessControl.FileSystemAccessRule('SYSTEM', 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $admins = New-Object System.Security.AccessControl.FileSystemAccessRule('BUILTIN\Administrators', 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($system)
    $acl.AddAccessRule($admins)
    Set-Acl -Path $Path -AclObject $acl
}

function Get-ConfigValue([string]$Content, [string]$Key) {
    $match = [regex]::Match($Content, "(?m)^$([regex]::Escape($Key))=(.+)$")
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
    return ''
}

function Test-SensorCredential([string]$ApiUrl, [string]$Token) {
    return $ApiUrl -match '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$' -and $Token -match '^ts1\.[0-9a-fA-F-]{36}\.[A-Za-z0-9_-]{32,64}$'
}

function Revoke-SensorCredential([string]$ApiUrl, [string]$Token) {
    if (-not (Test-SensorCredential $ApiUrl $Token)) { return $false }
    try {
        Invoke-WebRequest -UseBasicParsing -Method Delete -Uri "$ApiUrl/sensors/self" -Headers @{ 'X-Sensor-Token' = $Token } -TimeoutSec 10 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Wait-ForSensorReady([string]$Token) {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-Path $ConfigPath) {
            $content = Get-Content -Raw -Path $ConfigPath
            $newToken = Get-ConfigValue $content 'SENSOR_TOKEN'
            if (Test-SensorCredential $ApiBaseUrl $newToken) {
                try {
                    Invoke-WebRequest -UseBasicParsing -Uri "$ApiBaseUrl/sensors/self/ready" -Headers @{ 'X-Sensor-Token' = $newToken } -TimeoutSec 5 | Out-Null
                    return $newToken
                } catch { }
            }
        }
        Start-Sleep -Seconds 1
    }
    throw 'The sensor could not connect. Generate a new installation code and try again.'
}

if (-not (Test-Administrator)) { throw 'Administrator approval is required.' }
if ($ApiBaseUrl -notmatch '^https://') { throw 'The installer refused a non-HTTPS server address.' }

if ($Action -eq 'Remove') {
    $oldContent = if (Test-Path $ConfigPath) { Get-Content -Raw -Path $ConfigPath } else { '' }
    $oldApiUrl = Get-ConfigValue $oldContent 'API_BASE_URL'
    $oldToken = Get-ConfigValue $oldContent 'SENSOR_TOKEN'
    schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
    Revoke-SensorCredential $oldApiUrl $oldToken | Out-Null
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $InstallRoot, $DataRoot
    return
}

if ($EnrollmentCode -notmatch '^[A-Za-z0-9_-]{32,64}$') { throw 'The installation code format is not valid.' }
if (-not (Test-Path (Join-Path $env:WINDIR 'System32\Npcap\wpcap.dll')) -and -not (Test-Path (Join-Path $env:WINDIR 'System32\wpcap.dll'))) {
    throw 'Npcap is required for packet capture. Install it from https://npcap.com/#download and try again.'
}

& py -3.11 --version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 is required. Install it from https://www.python.org/downloads/windows/ and try again.' }

$oldContent = if (Test-Path $ConfigPath) { Get-Content -Raw -Path $ConfigPath } else { '' }
$oldApiUrl = Get-ConfigValue $oldContent 'API_BASE_URL'
$oldToken = Get-ConfigValue $oldContent 'SENSOR_TOKEN'
$installComplete = $false

try {
    schtasks.exe /End /TN $TaskName 2>$null | Out-Null
    Set-PrivateDirectory $InstallRoot
    Set-PrivateDirectory $DataRoot
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $InstallRoot 'engine')
    Copy-Item -Recurse -Force (Join-Path $ScriptRoot 'engine') (Join-Path $InstallRoot 'engine')
    Copy-Item -Force (Join-Path $ScriptRoot 'requirements.txt') (Join-Path $InstallRoot 'requirements.txt')

    $venvPath = Join-Path $InstallRoot 'venv'
    $pythonPath = Join-Path $venvPath 'Scripts\python.exe'
    if (-not (Test-Path $pythonPath)) {
        & py -3.11 -m venv $venvPath
    }
    & $pythonPath -m pip install --disable-pip-version-check -r (Join-Path $InstallRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'ThreatScope could not install its sensor dependencies.' }

    @(
        "API_BASE_URL=$ApiBaseUrl",
        "API_URL=$ApiBaseUrl/alerts",
        "SENSOR_ENROLLMENT_CODE=$EnrollmentCode",
        'SENSOR_HEARTBEAT_INTERVAL_SECONDS=5',
        'MONITORING_DEFAULT_ENABLED=true'
    ) | Set-Content -Path $ConfigPath -Encoding ascii -NoNewline

    $runnerPath = Join-Path $InstallRoot 'run_sensor.cmd'
    @(
        '@echo off',
        "set `"THREATSCOPE_CONFIG_PATH=$ConfigPath`"",
        "`"$pythonPath`" -u `"$(Join-Path $InstallRoot 'engine\sensor.py')`" >> `"$(Join-Path $DataRoot 'sensor.log')`" 2>&1"
    ) | Set-Content -Path $runnerPath -Encoding ascii

    schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
    schtasks.exe /Create /TN $TaskName /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "`"$runnerPath`"" /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'ThreatScope could not create its Windows background task.' }
    schtasks.exe /Run /TN $TaskName | Out-Null

    $newToken = Wait-ForSensorReady
    $installComplete = $true
    if ($oldToken -and $oldToken -ne $newToken) {
        Revoke-SensorCredential $oldApiUrl $oldToken | Out-Null
    }
} catch {
    if (-not $installComplete) {
        schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
        if ($oldContent) {
            $oldContent | Set-Content -Path $ConfigPath -Encoding ascii -NoNewline
        }
    }
    throw
}
