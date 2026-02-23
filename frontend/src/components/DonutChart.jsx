import { useRef, useEffect, useMemo } from 'react'

export default function DonutChart({ measured = 0, reconciled = 0, deviation = 0, size = 300, resolved }) {
  const canvasRef = useRef()

  const colors = resolved?.colors
  const fontFamily = resolved?.fontFamily || "'Montserrat', sans-serif"
  const cPrimary = colors?.primary || '#3b82f6'
  const cSuccess = colors?.success || '#4ade80'
  const cWarning = colors?.warning || '#f59e0b'
  const cDanger = colors?.danger || '#f87171'
  const cGrid = colors?.grid || '#1e293b'
  const cMuted = colors?.muted || '#94a3b8'

  const devColor = deviation > 5 ? cDanger : cWarning

  const legendItems = useMemo(() => [
    { color: cPrimary, label: 'Изм. вход' },
    { color: cSuccess, label: 'Согл. вход' },
    { color: devColor, label: '\u0394 отклонение' },
  ], [cPrimary, cSuccess, devColor])

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
    const innerR = outerR * 0.55
    const total = measured + reconciled + Math.abs(deviation)
    if (total === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true)
      ctx.fillStyle = cGrid
      ctx.fill()
      return
    }

    const segments = [
      { value: measured, color: cPrimary, label: 'Изм' },
      { value: reconciled, color: cSuccess, label: 'Согл' },
      { value: Math.abs(deviation), color: devColor, label: '\u0394' },
    ]

    // Draw segments
    let angle = -Math.PI / 2
    const segAngles = []
    segments.forEach(seg => {
      if (seg.value <= 0) {
        segAngles.push(null)
        return
      }
      const sweep = (seg.value / total) * Math.PI * 2
      const startAngle = angle
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, angle, angle + sweep)
      ctx.arc(cx, cy, innerR, angle + sweep, angle, true)
      ctx.closePath()
      ctx.fillStyle = seg.color
      ctx.fill()
      segAngles.push({ start: startAngle, sweep })
      angle += sweep
    })

    // Draw sector labels on the arc
    const labelR = (outerR + innerR) / 2
    segments.forEach((seg, i) => {
      if (!segAngles[i] || seg.value <= 0) return
      const { start, sweep } = segAngles[i]
      // Only show label if segment is big enough
      if (sweep < 0.3) return
      const midAngle = start + sweep / 2
      const lx = cx + Math.cos(midAngle) * labelR
      const ly = cy + Math.sin(midAngle) * labelR
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.max(8, size * 0.07)}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(seg.label, lx, ly)
    })

    // Center text — deviation percentage
    const pct = Math.abs(deviation).toFixed(1)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `bold ${size * 0.17}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${pct}%`, cx, cy - size * 0.03)
    ctx.fillStyle = cMuted
    ctx.font = `${size * 0.08}px ${fontFamily}`
    ctx.fillText('отклонение', cx, cy + size * 0.13)
  }, [measured, reconciled, deviation, size, cPrimary, cSuccess, devColor, cGrid, cMuted, fontFamily])

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="shrink-0"
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          marginTop: 8,
          fontFamily: fontFamily,
          fontSize: Math.max(11, size * 0.04),
          color: cMuted,
          flexWrap: 'wrap',
        }}
      >
        {legendItems.map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
