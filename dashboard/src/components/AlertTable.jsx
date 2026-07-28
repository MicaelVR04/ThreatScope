import { useCallback, useState, useMemo } from 'react'
import Button from './theme/Button'
import Tag from './theme/Tag'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { threatLabel, threatPlainEnglish } from '../utils/threatLabels'

const COLUMNS = [
  { key: 'severity',  label: 'Severity' },
  { key: 'type',      label: 'Type' },
  { key: 'device',    label: 'Device' },
  { key: 'src_ip',    label: 'Source IP' },
  { key: 'dst_ip',    label: 'Destination IP' },
  { key: 'timestamp', label: 'Timestamp' },
]

const SEV_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default function AlertTable({ alerts = [], sensorNameById = new Map() }) {
  const [sortKey, setSortKey]   = useState('timestamp')
  const [sortDir, setSortDir]   = useState('desc')
  const [filter,  setFilter]    = useState('ALL')

  const deviceName = useCallback(
    alert => sensorNameById.get(alert.sensor_id) || 'Unknown device',
    [sensorNameById]
  )

  const filtered = useMemo(() =>
    filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter)
  , [alerts, filter])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey]
    if (sortKey === 'severity') { va = SEV_ORDER[va] ?? 9; vb = SEV_ORDER[vb] ?? 9 }
    if (sortKey === 'timestamp') { va = new Date(va); vb = new Date(vb) }
    if (sortKey === 'device') { va = deviceName(a); vb = deviceName(b) }
    if (va < vb) return sortDir === 'asc' ? -1 :  1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  }), [filtered, sortKey, sortDir, deviceName])

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} className="text-ink-faint" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-signal" />
      : <ChevronDown size={12} className="text-signal" />
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
          <Button
            key={f}
            variant="ghost"
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? 'bg-signal-dim text-signal' : ''}
          >
            {f}
          </Button>
        ))}
        <span className="w-full text-xs text-ink-faint sm:ml-auto sm:w-auto">{sorted.length} alert{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="py-4 italic text-ink-faint">No alerts to display.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] text-ink">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="cursor-pointer select-none border-b border-white/[0.08] px-3.5 py-2.5 text-left font-semibold text-ink-muted transition-colors duration-150 ease-swift hover:text-ink"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((alert, i) => (
                <tr key={alert.id ?? i} className="bg-surface transition-colors duration-150 ease-swift hover:bg-surface-2">
                  <td className="border-b border-white/[0.08] px-3.5 py-2.5"><Tag severity={alert.severity}>{alert.severity}</Tag></td>
                  <td className="border-b border-white/[0.08] px-3.5 py-2.5">
                    <span className="block font-bold text-ink">{threatLabel(alert.type)}</span>
                    <span className="mt-0.5 inline-block text-[11px] text-ink-faint">{alert.type}</span>
                    <span className="mt-1 block max-w-[360px] text-xs leading-[1.4] text-ink-muted">{threatPlainEnglish(alert.type)}</span>
                  </td>
                  <td className="border-b border-white/[0.08] px-3.5 py-2.5 text-ink-muted">{deviceName(alert)}</td>
                  <td className="border-b border-white/[0.08] px-3.5 py-2.5 font-mono">{alert.src_ip}</td>
                  <td className="border-b border-white/[0.08] px-3.5 py-2.5 font-mono">{alert.dst_ip}</td>
                  <td className="border-b border-white/[0.08] px-3.5 py-2.5 text-xs text-ink-faint">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
