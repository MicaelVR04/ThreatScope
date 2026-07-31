import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Clipboard, Download, ExternalLink, KeyRound, Laptop, Loader2, Monitor, ShieldCheck, Trash2 } from 'lucide-react'
import Button from './theme/Button'
import { createSensorEnrollment, getSensors, revokeSensor } from '../services/api'

const MACOS_INSTALLER_URL = import.meta.env.VITE_SENSOR_INSTALLER_URL?.trim()
  || '/downloads/ThreatScope-Sensor-macOS.zip'
const WINDOWS_INSTALLER_URL = import.meta.env.VITE_WINDOWS_SENSOR_INSTALLER_URL?.trim()
  || '/downloads/ThreatScope-Sensor-Windows.zip'
const CURRENT_SENSOR_VERSION = '1.2.0'

function isOlderSensorVersion(version) {
  const installed = String(version || '').split('.').map(Number)
  const current = CURRENT_SENSOR_VERSION.split('.').map(Number)

  if (installed.length < 2 || installed.some(Number.isNaN)) return false

  for (let index = 0; index < current.length; index += 1) {
    const installedPart = installed[index] || 0
    if (installedPart !== current[index]) return installedPart < current[index]
  }
  return false
}

export default function SensorEnrollmentPanel({ sensorOnline }) {
  const [sensors, setSensors] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [devicesExpanded, setDevicesExpanded] = useState(true)

  const loadSensors = useCallback(async () => {
    try {
      setSensors(await getSensors())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load registered sensors.')
    }
  }, [])

  useEffect(() => {
    loadSensors()
  }, [loadSensors, sensorOnline])

  const activeSensors = useMemo(
    () => sensors.filter(sensor => !sensor.revoked_at),
    [sensors],
  )
  const outdatedSensors = useMemo(
    () => activeSensors.filter(sensor => isOlderSensorVersion(sensor.version)),
    [activeSensors],
  )
  const installedVersions = useMemo(
    () => [...new Set(activeSensors.map(sensor => sensor.version || 'unknown'))],
    [activeSensors],
  )
  const updateAvailable = outdatedSensors.length > 0

  async function generateCode() {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      setEnrollment(await createSensorEnrollment())
    } catch (generateError) {
      setError(generateError.message || 'Unable to create an installation code.')
    } finally {
      setLoading(false)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(enrollment.code)
      setCopied(true)
    } catch {
      setError('Copy was blocked by the browser. Select the code and copy it manually.')
    }
  }

  async function removeSensor(sensor) {
    if (!window.confirm(`Remove access for ${sensor.name}? The sensor will stop connecting to this account.`)) return
    setLoading(true)
    setError(null)
    try {
      await revokeSensor(sensor.id)
      await loadSensors()
    } catch (removeError) {
      setError(removeError.message || 'Unable to remove this sensor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mb-[18px] rounded-xl border border-white/[0.08] bg-surface px-5 py-5 sm:px-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">Sensor installation</p>
          <h2 className="mt-2 font-display text-lg font-semibold text-ink">
            {sensorOnline ? 'Your network sensor is connected' : 'Connect a network sensor without Terminal'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Choose macOS or Windows, paste a one-time code, and approve the normal administrator prompt.
            The code expires after ten minutes and cannot be reused.
          </p>
        </div>
        <div className={`flex items-center gap-2 font-mono text-xs ${updateAvailable ? 'text-severity-medium' : sensorOnline ? 'text-severity-low' : 'text-severity-medium'}`}>
          {updateAvailable ? <AlertTriangle size={16} /> : sensorOnline ? <CheckCircle2 size={16} /> : <Laptop size={16} />}
          {updateAvailable ? 'UPDATE AVAILABLE' : sensorOnline ? 'CONNECTED' : 'SETUP NEEDED'}
        </div>
      </div>

      <div className="mt-5 grid gap-px overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
        <div className="bg-base/80 px-4 py-3">
          <p className="font-mono text-[10px] uppercase text-ink-faint">Latest available</p>
          <p className="mt-1 font-display text-sm font-semibold text-ink">Sensor {CURRENT_SENSOR_VERSION}</p>
        </div>
        <div className="bg-base/80 px-4 py-3">
          <p className="font-mono text-[10px] uppercase text-ink-faint">Installed on your devices</p>
          <p className={`mt-1 break-words font-display text-sm font-semibold ${updateAvailable ? 'text-severity-medium' : 'text-ink'}`}>
            {installedVersions.length ? installedVersions.map(version => `Sensor ${version}`).join(', ') : 'No sensor registered'}
          </p>
        </div>
      </div>

      {updateAvailable && (
        <div className="mt-5 rounded-md border border-severity-medium/40 bg-severity-medium/10 px-4 py-4">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-severity-medium" />
            <div>
              <p className="font-display text-sm font-semibold text-ink">Update your sensor to {CURRENT_SENSOR_VERSION}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Your installed sensor uses older detection rules. Download the latest setup, generate a new
                code, and run it again. After version {CURRENT_SENSOR_VERSION} reports healthy, setup securely
                removes the previous registration from this Mac. If it remains visible, use Remove access below.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 border-y border-white/[0.08] py-5 md:grid-cols-3">
        <SetupStep Icon={Download} number="1" title="Download" body="Choose the setup package for the computer that will monitor traffic." />
        <SetupStep Icon={KeyRound} number="2" title="Connect" body="Paste the private installation code shown here." />
        <SetupStep Icon={ShieldCheck} number="3" title="Approve" body="Approve the normal macOS or Windows administrator prompt." />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={MACOS_INSTALLER_URL}
          download="ThreatScope-Sensor-macOS.zip"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-signal px-5 font-display text-sm font-semibold text-base transition-colors hover:bg-signal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <Download size={16} /> Download for macOS
        </a>
        <a
          href={WINDOWS_INSTALLER_URL}
          download="ThreatScope-Sensor-Windows.zip"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-signal/35 px-5 font-display text-sm font-semibold text-signal transition-colors hover:bg-signal-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <Monitor size={16} /> Download for Windows
        </a>
        <Button variant="secondary" size="sm" onClick={generateCode} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {enrollment ? 'Generate a new code' : 'Generate installation code'}
        </Button>
      </div>

      <details className="group mt-5 rounded-md border border-severity-medium/35 bg-severity-medium/5">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none hover:bg-severity-medium/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal">
          <span className="flex min-w-0 items-start gap-3">
            <CircleHelp size={19} className="mt-0.5 shrink-0 text-severity-medium" />
            <span className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-severity-medium">Setup help</span>
              <span className="mt-0.5 block font-display text-sm font-semibold text-ink">Setup app blocked by macOS?</span>
              <span className="mt-0.5 block text-xs font-normal leading-relaxed text-ink-muted">Open the recovery instructions to finish installing the sensor.</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-display text-xs font-semibold text-signal">
            <span className="hidden sm:inline">View steps</span>
            <ChevronDown size={16} className="transition-transform duration-200 group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-white/[0.08] px-4 py-4 text-sm leading-relaxed text-ink-muted">
          <p>
            This school-project build is integrity-signed but not yet notarized by Apple. Do not disable
            macOS security. After trying to open the app once:
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>Dismiss the warning with <strong className="text-ink">Done</strong>.</li>
            <li>Open <strong className="text-ink">System Settings → Privacy &amp; Security</strong> and scroll to Security.</li>
            <li>Click <strong className="text-ink">Open Anyway</strong>, approve with your password, then click Open.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-faint">
            Apple makes Open Anyway available for about one hour after the blocked launch.
          </p>
          <a
            href="https://support.apple.com/en-us/102445"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-display text-xs font-semibold text-signal hover:text-signal/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            Read Apple&apos;s instructions <ExternalLink size={13} />
          </a>
        </div>
      </details>

      <details className="group mt-3 rounded-md border border-white/[0.1] bg-base/50">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal">
          <span className="flex min-w-0 items-start gap-3">
            <CircleHelp size={19} className="mt-0.5 shrink-0 text-signal" />
            <span className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-signal">Windows setup help</span>
              <span className="mt-0.5 block font-display text-sm font-semibold text-ink">Install the Windows sensor safely</span>
              <span className="mt-0.5 block text-xs font-normal leading-relaxed text-ink-muted">Open the project-preview setup window after extracting the ZIP.</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-display text-xs font-semibold text-signal">
            <span className="hidden sm:inline">View steps</span>
            <ChevronDown size={16} className="transition-transform duration-200 group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-white/[0.08] px-4 py-4 text-sm leading-relaxed text-ink-muted">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Install the <a href="https://www.python.org/downloads/windows/" target="_blank" rel="noreferrer" className="font-semibold text-signal hover:text-signal/80">latest stable Python 3 release</a> and <a href="https://npcap.com/dist/" target="_blank" rel="noreferrer" className="font-semibold text-signal hover:text-signal/80">Npcap</a> from their official sites if they are not already installed.</li>
            <li>Extract the downloaded ZIP and double-click <strong className="text-ink">Start ThreatScope Sensor Setup</strong>.</li>
            <li>Approve the standard Windows User Account Control prompt, paste the one-time code, and select Install.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-faint">
            This project-preview setup supports Python 3.11 through 3.14. Use the latest stable release, currently Python 3.14.6, and do not choose a Python 3.15 pre-release. Windows 10 or 11 and Npcap are also required. Do not disable Microsoft Defender or Windows security.
          </p>
        </div>
      </details>

      <details className="group mt-3 rounded-md border border-signal/25 bg-signal-dim/40">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none hover:bg-signal-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal">
          <span className="flex min-w-0 items-start gap-3">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-signal" />
            <span className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-signal">Windows verification</span>
              <span className="mt-0.5 block font-display text-sm font-semibold text-ink">Check that the sensor is working</span>
              <span className="mt-0.5 block text-xs font-normal leading-relaxed text-ink-muted">Confirm the secure connection, then confirm live packet activity.</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-display text-xs font-semibold text-signal">
            <span className="hidden sm:inline">View checks</span>
            <ChevronDown size={16} className="transition-transform duration-200 group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-signal/20 px-4 py-4 text-sm leading-relaxed text-ink-muted">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Setup must finish with <strong className="text-ink">Sensor connected successfully</strong>. That confirms the one-time code was exchanged for a private sensor credential and the API received its first heartbeat.</li>
            <li>Refresh this page. Under <strong className="text-ink">Registered sensors</strong>, confirm the device lists <strong className="text-ink">Windows</strong> with a recent “Last connected” time.</li>
            <li>Start monitoring, browse normally for a minute, and confirm the dashboard&apos;s <strong className="text-ink">Live Network Pulse</strong> shows packet activity.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-faint">
            Connection and packet activity prove setup and capture are active. The team&apos;s deterministic demo traffic remains the repeatable way to prove alert rules end to end.
          </p>
        </div>
      </details>

      {enrollment && (
        <div className="mt-5 rounded-md border border-signal/25 bg-signal-dim px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal">One-time installation code</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 select-all break-all font-mono text-sm font-bold text-ink">{enrollment.code}</code>
            <Button variant="ghost" size="sm" className="shrink-0 sm:ml-auto" onClick={copyCode}>
              {copied ? <CheckCircle2 size={15} /> : <Clipboard size={15} />}
              {copied ? 'Copied' : 'Copy code'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Expires {new Date(enrollment.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
            Creating another code immediately disables this one.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-severity-high">{error}</p>}

      {activeSensors.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 border-y border-white/[0.08] py-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Registered sensors</h3>
              <p className="mt-0.5 text-xs text-ink-faint">
                {activeSensors.length} {activeSensors.length === 1 ? 'device' : 'devices'} connected to this account
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDevicesExpanded(current => !current)}
              aria-expanded={devicesExpanded}
              aria-controls="registered-sensor-list"
            >
              {devicesExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {devicesExpanded ? 'Hide devices' : 'Show devices'}
            </Button>
          </div>
          {devicesExpanded && (
            <div id="registered-sensor-list" className="divide-y divide-white/[0.08] border-b border-white/[0.08]">
              {activeSensors.map(sensor => (
                <div key={sensor.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Laptop size={16} className="shrink-0 text-signal" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{sensor.name}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {sensor.platform} · Version {sensor.version || 'unknown'} · {sensor.last_seen_at ? `Last connected ${new Date(sensor.last_seen_at).toLocaleString()}` : 'Waiting for first connection'}
                    </p>
                  </div>
                  {isOlderSensorVersion(sensor.version) && (
                    <span className="rounded-full border border-severity-medium/30 bg-severity-medium/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-severity-medium">
                      Update available
                    </span>
                  )}
                  <Button variant="danger" size="sm" onClick={() => removeSensor(sensor)} disabled={loading}>
                    <Trash2 size={14} /> Remove access
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SetupStep({ Icon, number, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-signal/25 bg-signal-dim text-signal">
        <Icon size={16} />
      </div>
      <div>
        <p className="font-mono text-[10px] text-ink-faint">STEP {number}</p>
        <h3 className="mt-0.5 font-display text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  )
}
