import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import SensorEnrollmentPanel from '../components/SensorEnrollmentPanel'
import { getScanStatus } from '../services/api'

export default function SensorManagement() {
  const [scanStatus, setScanStatus] = useState(null)
  const [error, setError] = useState(null)
  const [statusLoaded, setStatusLoaded] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      setScanStatus(await getScanStatus())
      setError(null)
    } catch (statusError) {
      setError(statusError.message || 'Unable to load sensor status.')
    } finally {
      setStatusLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 5000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  const sensorOnline = Boolean(scanStatus?.sensor?.online)

  return (
    <main className="relative flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">Device management</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Network sensors</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Install, review, and revoke the devices authorized to monitor this account.
            </p>
          </div>
          <div className={`flex items-center gap-2 font-mono text-xs ${sensorOnline ? 'text-severity-low' : error ? 'text-severity-high' : statusLoaded ? 'text-severity-medium' : 'text-ink-faint'}`}>
            {sensorOnline ? <CheckCircle2 size={16} /> : statusLoaded ? <WifiOff size={16} /> : <Loader2 size={16} className="animate-spin" />}
            {sensorOnline ? 'SENSOR ONLINE' : error ? 'STATUS UNAVAILABLE' : statusLoaded ? 'SENSOR OFFLINE' : 'CHECKING STATUS'}
          </div>
        </header>

        {error && <p className="mb-4 text-sm text-severity-high">{error}</p>}
        <SensorEnrollmentPanel sensorOnline={sensorOnline} />
      </div>
    </main>
  )
}
