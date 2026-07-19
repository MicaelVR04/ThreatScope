import { useEffect, useRef } from 'react'

// Draws the real per-bucket event-volume curve from chartData (the same
// data source as the hero's sparkline) and animates a traveling pulse along
// it. The curve itself is always real data — only the traveling highlight
// is decorative — so this never fabricates traffic that didn't happen, the
// way a random-spike waveform would.
export default function NetworkPulse({ data }) {
  const canvasRef = useRef(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, rect.width * devicePixelRatio)
      canvas.height = Math.max(1, rect.height * devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function pointsFor(w, h) {
      const buckets = dataRef.current
      if (!buckets || buckets.length === 0) {
        return [{ x: 0, y: h / 2 }, { x: w, y: h / 2 }]
      }
      const totals = buckets.map(d => (d.HIGH || 0) + (d.MEDIUM || 0) + (d.LOW || 0))
      const max = Math.max(1, ...totals)
      const step = w / Math.max(1, totals.length - 1)
      return totals.map((v, i) => ({ x: i * step, y: h - (v / max) * h * 0.75 - h * 0.12 }))
    }

    let raf
    let t = 0

    function draw() {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const pts = pointsFor(w, h)

      ctx.beginPath()
      ctx.strokeStyle = '#2EEBD1'
      ctx.lineWidth = 2 * devicePixelRatio
      ctx.shadowColor = 'rgba(46,235,209,.45)'
      ctx.shadowBlur = reduceMotion ? 0 : 6 * devicePixelRatio
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()

      if (!reduceMotion && pts.length > 1) {
        const cycleMs = 4000
        const p = (t % cycleMs) / cycleMs
        const idx = p * (pts.length - 1)
        const i0 = Math.floor(idx)
        const i1 = Math.min(pts.length - 1, i0 + 1)
        const f = idx - i0
        const x = pts[i0].x + (pts[i1].x - pts[i0].x) * f
        const y = pts[i0].y + (pts[i1].y - pts[i0].y) * f

        ctx.beginPath()
        ctx.fillStyle = '#2EEBD1'
        ctx.shadowBlur = 10 * devicePixelRatio
        ctx.arc(x, y, 3.5 * devicePixelRatio, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!reduceMotion) {
        t += 16
        raf = requestAnimationFrame(draw)
      }
    }
    draw()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="block h-full w-full" />
}
