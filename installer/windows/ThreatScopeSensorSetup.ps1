[CmdletBinding()]
param([switch]$Elevated)

$ErrorActionPreference = 'Stop'
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$HelperPath = Join-Path $ScriptRoot 'install_helper.ps1'

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not $Elevated -and -not (Test-Administrator)) {
    $arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated"
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments
    exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-SetupError([string]$Message) {
    [System.Windows.Forms.MessageBox]::Show($Message, 'ThreatScope Sensor Setup', 'OK', 'Error') | Out-Null
}

function Test-Prerequisite([string]$Name) {
    switch ($Name) {
        'Python' {
            try {
                $version = & py -3.11 --version 2>$null
                return $LASTEXITCODE -eq 0 -and $version -match 'Python 3\.11'
            } catch {
                return $false
            }
        }
        'Npcap' {
            return (Test-Path (Join-Path $env:WINDIR 'System32\Npcap\wpcap.dll')) -or
                (Test-Path (Join-Path $env:WINDIR 'System32\wpcap.dll'))
        }
    }
    return $false
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'ThreatScope Sensor Setup'
$form.Size = New-Object System.Drawing.Size(620, 470)
$form.MinimumSize = New-Object System.Drawing.Size(620, 470)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(7, 10, 15)
$form.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Connect this Windows computer to ThreatScope'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
$title.Location = New-Object System.Drawing.Point(28, 26)
$title.Size = New-Object System.Drawing.Size(550, 34)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Paste a short-lived installation code from your dashboard. The sensor runs as a Windows background task and can be removed at any time.'
$subtitle.Location = New-Object System.Drawing.Point(30, 70)
$subtitle.Size = New-Object System.Drawing.Size(545, 48)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)

$requirements = New-Object System.Windows.Forms.Label
$requirements.Location = New-Object System.Drawing.Point(30, 132)
$requirements.Size = New-Object System.Drawing.Size(545, 45)
$requirements.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)

$codeLabel = New-Object System.Windows.Forms.Label
$codeLabel.Text = 'One-time installation code'
$codeLabel.Location = New-Object System.Drawing.Point(30, 194)
$codeLabel.Size = New-Object System.Drawing.Size(250, 24)

$codeBox = New-Object System.Windows.Forms.TextBox
$codeBox.Location = New-Object System.Drawing.Point(30, 222)
$codeBox.Size = New-Object System.Drawing.Size(545, 28)
$codeBox.UseSystemPasswordChar = $true

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(30, 273)
$status.Size = New-Object System.Drawing.Size(545, 42)
$status.ForeColor = [System.Drawing.Color]::FromArgb(45, 212, 191)

$installButton = New-Object System.Windows.Forms.Button
$installButton.Text = 'Install sensor'
$installButton.Location = New-Object System.Drawing.Point(30, 340)
$installButton.Size = New-Object System.Drawing.Size(150, 38)
$installButton.BackColor = [System.Drawing.Color]::FromArgb(45, 212, 191)
$installButton.ForeColor = [System.Drawing.Color]::FromArgb(7, 10, 15)
$installButton.FlatStyle = 'Flat'

$removeButton = New-Object System.Windows.Forms.Button
$removeButton.Text = 'Remove sensor'
$removeButton.Location = New-Object System.Drawing.Point(192, 340)
$removeButton.Size = New-Object System.Drawing.Size(150, 38)
$removeButton.FlatStyle = 'Flat'

$pythonButton = New-Object System.Windows.Forms.Button
$pythonButton.Text = 'Get Python 3.11'
$pythonButton.Location = New-Object System.Drawing.Point(354, 340)
$pythonButton.Size = New-Object System.Drawing.Size(105, 38)
$pythonButton.FlatStyle = 'Flat'

$npcapButton = New-Object System.Windows.Forms.Button
$npcapButton.Text = 'Get Npcap'
$npcapButton.Location = New-Object System.Drawing.Point(470, 340)
$npcapButton.Size = New-Object System.Drawing.Size(105, 38)
$npcapButton.FlatStyle = 'Flat'

$note = New-Object System.Windows.Forms.Label
$note.Text = 'Project preview: do not disable Microsoft Defender or Windows security. Install prerequisites only from the official links.'
$note.Location = New-Object System.Drawing.Point(30, 398)
$note.Size = New-Object System.Drawing.Size(545, 38)
$note.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)

$form.Controls.AddRange(@($title, $subtitle, $requirements, $codeLabel, $codeBox, $status, $installButton, $removeButton, $pythonButton, $npcapButton, $note))

function Update-Prerequisites {
    $pythonReady = Test-Prerequisite 'Python'
    $npcapReady = Test-Prerequisite 'Npcap'
    $requirements.Text = "Python 3.11: $(if ($pythonReady) { 'ready' } else { 'required' })     Npcap: $(if ($npcapReady) { 'ready' } else { 'required' })"
    $requirements.ForeColor = if ($pythonReady -and $npcapReady) {
        [System.Drawing.Color]::FromArgb(45, 212, 191)
    } else {
        [System.Drawing.Color]::FromArgb(251, 191, 36)
    }
    return $pythonReady -and $npcapReady
}

$pythonButton.Add_Click({ Start-Process 'https://www.python.org/downloads/windows/' })
$npcapButton.Add_Click({ Start-Process 'https://npcap.com/dist/' })

$installButton.Add_Click({
    $code = $codeBox.Text.Trim()
    if ($code -notmatch '^[A-Za-z0-9_-]{32,64}$') {
        Show-SetupError 'Paste a valid one-time installation code from the ThreatScope dashboard.'
        return
    }
    if (-not (Update-Prerequisites)) {
        Show-SetupError 'Install Python 3.11 and Npcap, then reopen this setup window.'
        return
    }
    $installButton.Enabled = $false
    $removeButton.Enabled = $false
    $status.Text = 'Installing the sensor and waiting for its first secure connection...'
    $form.Refresh()
    try {
        & $HelperPath -Action Install -EnrollmentCode $code
        [System.Windows.Forms.MessageBox]::Show('Sensor connected successfully. Return to the ThreatScope dashboard to confirm monitoring.', 'ThreatScope Sensor Setup', 'OK', 'Information') | Out-Null
        $codeBox.Clear()
    } catch {
        Show-SetupError $_.Exception.Message
    } finally {
        $installButton.Enabled = $true
        $removeButton.Enabled = $true
        $status.Text = ''
    }
})

$removeButton.Add_Click({
    $choice = [System.Windows.Forms.MessageBox]::Show('Remove the local ThreatScope sensor from this computer?', 'ThreatScope Sensor Setup', 'YesNo', 'Warning')
    if ($choice -ne 'Yes') { return }
    try {
        & $HelperPath -Action Remove
        [System.Windows.Forms.MessageBox]::Show('The local sensor was removed. You can also revoke its record from the dashboard.', 'ThreatScope Sensor Setup', 'OK', 'Information') | Out-Null
    } catch {
        Show-SetupError $_.Exception.Message
    }
})

Update-Prerequisites | Out-Null
[void]$form.ShowDialog()
