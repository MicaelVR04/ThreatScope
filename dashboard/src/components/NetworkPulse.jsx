import { useEffect, useRef, useState } from 'react'

const MAX_SAMPLES = 24

// Visualizes packet-count deltas between distinct sensor heartbeats. A sample
// is added even when no packets arrived, so the timeline advances honestly.
export default function NetworkPulse({ packetCount = 0, sampleTimestamp = null, active = false, sensorKey = null }) {
  const canvasRef = useRef(null)
  const [samples, setSamples] = useState([0, 0])
  const [latestDelta, setLatestDelta] = useState(0)
  const previousCountRef = useRef(null)
  const previousTimestampRef = useRef(null)

  // packetCount is a cumulative counter per sensor — switching the selected
  // device without resetting this would diff the new sensor's count against
  // the previous one's, producing a fabricated spike or a suppressed delta.
  useEffect(() => {
    previousCountRef.current = null
    previousTimestampRef.current = null
    setSamples([0, 0])
    setLatestDelta(0)
  }, [sensorKey])

  useEffect(() => {
    const current = Number(packetCount) || 0
    const previous = previousCountRef.current
    const timestamp = sampleTimestamp || null

    if (timestamp && timestamp === previousTimestampRef.current) return
    if (!timestamp && previous !== null && current === previous) return

    previousCountRef.current = current
    previousTimestampRef.current = timestamp

    if (previous === null) return

    const delta = current >= previous ? current - previous : 0
    setLatestDelta(delta)
    setSamples(currentSamples => [...currentSamples, delta].slice(-MAX_SAMPLES))
  }, [packetCount, sampleTimestamp])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }

    function pointsFor(width, height) {
      const values = samples.length >= 2 ? samples : [0, 0]
      const max = Math.max(1, ...values)
      const step = width / Math.max(1, values.length - 1)

      return values.map((value, index) => ({
        x: index * step,
        y: height - (value / max) * height * 0.68 - height * 0.16,
      }))
    }

    let raf

    function draw(timestamp = 0) {
      const width = canvas.width
      const height = canvas.height
      const points = pointsFor(width, height)
      const monitoring = active

      ctx.clearRect(0, 0, width, height)

      ctx.beginPath()
      ctx.strokeStyle = monitoring ? '#2EEBD1' : '#727E8E'
      ctx.lineWidth = 2 * dpr
      ctx.shadowColor = monitoring ? 'rgba(46,235,209,.45)' : 'transparent'
      ctx.shadowBlur = monitoring && !reduceMotion ? 6 * dpr : 0
      points.forEach((point, index) => (
        index === 0
          ? ctx.moveTo(point.x, point.y)
          : ctx.lineTo(point.x, point.y)
      ))
      ctx.stroke()

      if (monitoring && !reduceMotion) {
        const progress = (timestamp % 4000) / 4000
        const position = progress * (points.length - 1)
        const startIndex = Math.floor(position)
        const endIndex = Math.min(points.length - 1, startIndex + 1)
        const fraction = position - startIndex
        const start = points[startIndex]
        const end = points[endIndex]
        const x = start.x + (end.x - start.x) * fraction
        const y = start.y + (end.y - start.y) * fraction

        ctx.beginPath()
        ctx.fillStyle = '#2EEBD1'
        ctx.shadowBlur = 10 * dpr
        ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!reduceMotion) raf = requestAnimationFrame(draw)
    }

    resize()
    const observer = new ResizeObserver(() => {
      resize()
      if (reduceMotion) draw()
    })
    observer.observe(canvas)
    draw()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [active, samples])

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={
          active
            ? `Live packet activity from the connected network sensor. ${latestDelta} packets in the latest sample.`
            : 'Packet activity unavailable because monitoring is paused or offline'
        }
      />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-base/80 px-2 py-1 font-mono text-[10px] text-ink-muted">
        {active ? `${latestDelta.toLocaleString()} packets / latest sample` : 'Pulse unavailable'}
      </span>
    </div>
  )
}
