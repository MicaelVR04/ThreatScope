import { useEffect, useRef, useState } from 'react'

// Fires `true` once the element crosses into the viewport, then disconnects —
// scroll reveals should play once, not re-trigger on every scroll pass.
export default function useReveal({ threshold = 0.2, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)

    // Safety net: reveals must enhance content that's already there, never
    // gate its existence. If the observer somehow never fires, don't leave
    // the section permanently at opacity-0.
    const fallback = setTimeout(() => setVisible(true), 2000)

    return () => {
      observer.disconnect()
      clearTimeout(fallback)
    }
  }, [threshold, rootMargin])

  return [ref, visible]
}
