import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clipboard, Download, ExternalLink, KeyRound, Laptop, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import Button from './theme/Button'
import { createSensorEnrollment, getSensors, revokeSensor } from '../services/api'

const INSTALLER_URL = import.meta.env.VITE_SENSOR_INSTALLER_URL?.trim()
  || '/downloads/ThreatScope-Sensor-macOS.zip'
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
            {sensorOnline ? 'Your network sensor is connected' : 'Connect this Mac without Terminal'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Download the setup app, paste a one-time code, and approve the normal macOS administrator prompt.
            The code expires after ten minutes and cannot be reused.
          </p>
        </div>
        <div className={`flex items-center gap-2 font-mono text-xs ${sensorOnline ? 'text-severity-low' : 'text-severity-medium'}`}>
          {sensorOnline ? <CheckCircle2 size={16} /> : <Laptop size={16} />}
          {sensorOnline ? 'CONNECTED' : 'SETUP NEEDED'}
        </div>
      </div>

      <div className="mt-6 grid gap-5 border-y border-white/[0.08] py-5 md:grid-cols-3">
        <SetupStep Icon={Download} number="1" title="Download" body="Open the ThreatScope Sensor setup app." />
        <SetupStep Icon={KeyRound} number="2" title="Connect" body="Paste the private installation code shown here." />
        <SetupStep Icon={ShieldCheck} number="3" title="Approve" body="Enter your Mac password when macOS asks for permission." />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={INSTALLER_URL}
          download="ThreatScope-Sensor-macOS.zip"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-signal px-5 font-display text-sm font-semibold text-base transition-colors hover:bg-signal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <Download size={16} /> Download for macOS
        </a>
        <Button variant="secondary" size="sm" onClick={generateCode} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {enrollment ? 'Generate a new code' : 'Generate installation code'}
        </Button>
      </div>

      {outdatedSensors.length > 0 && (
        <div className="mt-5 rounded-md border border-severity-medium/25 bg-severity-medium/5 px-4 py-4">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-severity-medium" />
            <div>
              <p className="font-display text-sm font-semibold text-ink">Sensor update available</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Version {CURRENT_SENSOR_VERSION} improves live-traffic accuracy and reduces false alerts from
                peer-to-peer apps. Download the latest setup, generate a new code, and run it again. After the
                new sensor connects, remove the older device entry below.
              </p>
            </div>
          </div>
        </div>
      )}

      <details className="mt-5 rounded-md border border-severity-medium/25 bg-severity-medium/5 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-sm font-semibold text-ink marker:content-none">
          <AlertTriangle size={16} className="shrink-0 text-severity-medium" />
          Did macOS block the setup app?
        </summary>
        <div className="mt-3 border-t border-white/[0.08] pt-3 text-sm leading-relaxed text-ink-muted">
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
