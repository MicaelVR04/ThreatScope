[CmdletBinding()]
param(
    [string]$OutputPath = 'dist\installer\ThreatScope-Sensor-Windows.zip'
)

$ErrorActionPreference = 'Stop'
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptRoot)
$StageRoot = Join-Path $ProjectRoot 'build\windows-installer'
$ResolvedOutputPath = Join-Path $ProjectRoot $OutputPath

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $StageRoot
New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null
Copy-Item -Force (Join-Path $ScriptRoot 'Start ThreatScope Sensor Setup.cmd') $StageRoot
Copy-Item -Force (Join-Path $ScriptRoot 'ThreatScopeSensorSetup.ps1') $StageRoot
Copy-Item -Force (Join-Path $ScriptRoot 'install_helper.ps1') $StageRoot
Copy-Item -Force (Join-Path $ScriptRoot 'README.md') $StageRoot
New-Item -ItemType Directory -Path (Join-Path $StageRoot 'engine') -Force | Out-Null
@('sensor.py', 'capture.py', 'rules.py', 'severity.py', 'alert_sender.py', 'sensor_config.py', '__init__.py') |
    ForEach-Object { Copy-Item -Force (Join-Path $ProjectRoot "engine\$_") (Join-Path $StageRoot 'engine') }
Copy-Item -Force (Join-Path $ProjectRoot 'engine\requirements.txt') (Join-Path $StageRoot 'requirements.txt')

New-Item -ItemType Directory -Path (Split-Path -Parent $ResolvedOutputPath) -Force | Out-Null
Remove-Item -Force -ErrorAction SilentlyContinue $ResolvedOutputPath
Compress-Archive -Path (Join-Path $StageRoot '*') -DestinationPath $ResolvedOutputPath -Force
Write-Host "Built $ResolvedOutputPath"
