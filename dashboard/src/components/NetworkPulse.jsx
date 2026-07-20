import { useEffect, useRef } from 'react'

const MAX_SAMPLES = 24

// Visualizes real packet-count deltas reported by the sensor. The moving
// highlight is decorative; the shape changes only when the sensor reports
// additional captured packets.
export default function NetworkPulse({ packetCount = 0, active = false }) {
  const canvasRef = useRef(null)
  const samplesRef = useRef([0, 0])
  const previousCountRef = useRef(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const current = Number(packetCount) || 0
    const previous = previousCountRef.current
    previousCountRef.current = current

    if (previous === null) return

    const delta = current >= previous ? current - previous : 0
    samplesRef.current = [...samplesRef.current, delta].slice(-MAX_SAMPLES)
  }, [packetCount])

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
      const samples = samplesRef.current.length >= 2 ? samplesRef.current : [0, 0]
      const max = Math.max(1, ...samples)
      const step = width / Math.max(1, samples.length - 1)

      return samples.map((value, index) => ({
        x: index * step,
        y: height - (value / max) * height * 0.68 - height * 0.16,
      }))
    }

    let raf

    function draw(timestamp = 0) {
      const width = canvas.width
      const height = canvas.height
      const points = pointsFor(width, height)
      const monitoring = activeRef.current

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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      role="img"
      aria-label={
        active
          ? 'Live packet activity from the connected network sensor'
          : 'Packet activity unavailable because monitoring is paused or offline'
      }
    />
  )
}
