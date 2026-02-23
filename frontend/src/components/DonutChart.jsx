import { useRef, useEffect } from 'react'

export default function DonutChart({ measured = 0, reconciled = 0, deviation = 0, size = 120 }) {
  const canvasRef = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const outerR = size / 2 - 4
    const innerR = outerR * 0.62
    const total = measured + reconciled + Math.abs(deviation)
    if (total === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true)
      ctx.fillStyle = '#1e293b'
      ctx.fill()
      return
    }

    const segments = [
      { value: measured, color: '#3b82f6' },
      { value: reconciled, color: '#4ade80' },
      { value: Math.abs(deviation), color: deviation > 5 ? '#f87171' : '#f59e0b' },
    ]

    let angle = -Math.PI / 2
    segments.forEach(seg => {
      if (seg.value <= 0) return
      const sweep = (seg.value / total) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, angle, angle + sweep)
      ctx.arc(cx, cy, innerR, angle + sweep, angle, true)
      ctx.closePath()
      ctx.fillStyle = seg.color
      ctx.fill()
      angle += sweep
    })

    // Center text
    const pct = Math.abs(deviation).toFixed(1)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `bold ${size * 0.16}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${pct}%`, cx, cy - size * 0.04)
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${size * 0.09}px Inter, sans-serif`
    ctx.fillText('невязка', cx, cy + size * 0.12)
  }, [measured, reconciled, deviation, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="shrink-0"
    />
  )
}
