import { useRef, useEffect } from 'react'

/**
 * Gauge (speedometer) chart showing plan execution percentage.
 * Canvas-based, arc from 180° to 0° (bottom half = empty).
 * Colors: green >95%, yellow 80-95%, red <80%.
 */
export default function GaugeChart({ percent = 0, size = 220, resolved }) {
  const canvasRef = useRef()

  const fontFamily = resolved?.fontFamily || "'Montserrat', sans-serif"

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    // Canvas is wider than tall since gauge is a semicircle
    const w = size
    const h = size * 0.65
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const cx = w / 2
    const cy = h - 10
    const outerR = Math.min(cx - 8, cy - 8)
    const innerR = outerR * 0.65
    const midR = (outerR + innerR) / 2
    const lineWidth = outerR - innerR

    const startAngle = Math.PI        // left (180°)
    const endAngle = 0                // right (0°)
    const totalSweep = Math.PI        // 180° arc

    const pct = Math.max(0, Math.min(percent, 150)) // cap at 150% for display

    // Background arc (dark track)
    ctx.beginPath()
    ctx.arc(cx, cy, midR, startAngle, endAngle)
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = '#1e293b'
    ctx.lineCap = 'butt'
    ctx.stroke()

    // Colored segments on the arc: red 0-80, yellow 80-95, green 95-100+
    const segments = [
      { from: 0, to: 80, color: '#f87171' },
      { from: 80, to: 95, color: '#fbbf24' },
      { from: 95, to: Math.min(pct, 150), color: '#4ade80' },
    ]

    segments.forEach(seg => {
      if (pct <= seg.from) return
      const segStart = seg.from / 100
      const segEnd = Math.min(seg.to, pct) / 100
      if (segEnd <= segStart) return

      const a1 = startAngle + segStart * totalSweep * -1 + totalSweep // map 0..1 to PI..0
      const a2 = startAngle + segEnd * totalSweep * -1 + totalSweep

      // Draw from higher angle to lower (PI→0 is left→right)
      const drawStart = Math.min(a1, a2)
      const drawEnd = Math.max(a1, a2)

      ctx.beginPath()
      ctx.arc(cx, cy, midR, drawEnd, drawStart, true)
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = seg.color
      ctx.lineCap = 'butt'
      ctx.stroke()
    })

    // Tick marks at 0%, 50%, 80%, 95%, 100%
    const ticks = [0, 50, 80, 95, 100]
    ticks.forEach(t => {
      const frac = t / 100
      const angle = startAngle - frac * totalSweep + totalSweep
      const realAngle = Math.PI - frac * Math.PI

      const x1 = cx + Math.cos(realAngle) * (outerR + 2)
      const y1 = cy - Math.sin(realAngle) * (outerR + 2)
      const x2 = cx + Math.cos(realAngle) * (outerR + 8)
      const y2 = cy - Math.sin(realAngle) * (outerR + 8)

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Label
      const lx = cx + Math.cos(realAngle) * (outerR + 18)
      const ly = cy - Math.sin(realAngle) * (outerR + 18)
      ctx.fillStyle = '#64748b'
      ctx.font = `${Math.max(8, size * 0.04)}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${t}%`, lx, ly)
    })

    // Needle
    const needlePct = Math.max(0, Math.min(pct, 120)) / 100
    const needleAngle = Math.PI - needlePct * Math.PI
    const needleLen = innerR - 6
    const nx = cx + Math.cos(needleAngle) * needleLen
    const ny = cy - Math.sin(needleAngle) * needleLen

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(nx, ny)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#e2e8f0'
    ctx.fill()

    // Center text — percentage
    const displayPct = percent.toFixed(1)
    const valueColor = percent >= 95 ? '#4ade80' : percent >= 80 ? '#fbbf24' : '#f87171'
    ctx.fillStyle = valueColor
    ctx.font = `bold ${size * 0.14}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${displayPct}%`, cx, cy - 12)

    // Sub-label
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${size * 0.055}px ${fontFamily}`
    ctx.textBaseline = 'top'
    ctx.fillText('Выполнение плана', cx, cy + 2)

  }, [percent, size, fontFamily, resolved])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size * 0.65 }}
      className="shrink-0"
    />
  )
}
