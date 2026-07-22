import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Clipboard, Download, KeyRound, Laptop, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import Button from './theme/Button'
import { createSensorEnrollment, getSensors, revokeSensor } from '../services/api'

const INSTALLER_URL = import.meta.env.VITE_SENSOR_INSTALLER_URL?.trim()
  || '/downloads/ThreatScope-Sensor-macOS.zip'

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
                      {sensor.platform} · {sensor.last_seen_at ? `Last connected ${new Date(sensor.last_seen_at).toLocaleString()}` : 'Waiting for first connection'}
                    </p>
                  </div>
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
