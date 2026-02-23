import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useRef } from 'react'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'

const CELL_W = 32
const CELL_H = 24
const LABEL_W = 180
const HEADER_H = 60

// Per-unit color palettes: [cold, mid, hot]
// Each unit has a distinct hue so they are visually distinguishable.
const UNIT_PALETTES = [
  // Unit 0 — blue hue
  { cold: [30, 58, 95], mid: [100, 130, 160], hot: [239, 68, 68] },
  // Unit 1 — green hue
  { cold: [6, 78, 59], mid: [60, 140, 90], hot: [245, 158, 11] },
  // Unit 2 — purple hue
  { cold: [49, 46, 129], mid: [120, 90, 170], hot: [236, 72, 153] },
  // Unit 3 — teal hue
  { cold: [19, 78, 74], mid: [60, 150, 140], hot: [249, 115, 22] },
]

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function lerpColor(c1, c2, t) {
  return [
    lerpChannel(c1[0], c2[0], t),
    lerpChannel(c1[1], c2[1], t),
    lerpChannel(c1[2], c2[2], t),
  ]
}

/**
 * Returns an RGB color string for a given temperature ratio and unit index.
 * ratio: 0 = cold (below yearly average), 0.5 = at average, 1 = hot (above average)
 * unitIndex: determines which color palette to use
 */
function tempColor(ratio, unitIndex) {
  const palette = UNIT_PALETTES[unitIndex % UNIT_PALETTES.length]
  const clamped = Math.max(0, Math.min(1, ratio))

  let rgb
  if (clamped <= 0.5) {
    // Interpolate from cold to mid
    const t = clamped / 0.5
    rgb = lerpColor(palette.cold, palette.mid, t)
  } else {
    // Interpolate from mid to hot
    const t = (clamped - 0.5) / 0.5
    rgb = lerpColor(palette.mid, palette.hot, t)
  }

  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

/**
 * Maps a daily value to a 0..1 ratio based on its deviation from the
 * yearly (overall) average for that unit's metric. The average is computed
 * across ALL dates in the selected range, excluding zero/non-working days.
 */
function computeRatio(value, yearlyAvg) {
  if (yearlyAvg === 0) return 0.5
  const diff = (value - yearlyAvg) / yearlyAvg
  return Math.max(0, Math.min(1, 0.5 + diff * 0.5))
}

/**
 * Builds an SVG gradient string with 11 stops for a given unit palette,
 * used in the per-unit legend bands.
 */
function buildGradientStops(unitIndex) {
  const stops = []
  for (let i = 0; i <= 10; i++) {
    const ratio = i / 10
    stops.push(`${tempColor(ratio, unitIndex)} ${ratio * 100}%`)
  }
  return stops.join(', ')
}

export default function HeatmapChart() {
  const { dateParams } = useDateFilter()
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['heatmap', dateParams],
    queryFn: () => api.get('/analytics/heatmap', { params: dateParams }).then(r => r.data),
  })

  const processed = useMemo(() => {
    if (!data || !data.dates || data.dates.length === 0) return null

    const dates = data.dates
    const rows = []
    const unitMeta = []

    data.units.forEach((unit, unitIndex) => {
      // Compute yearly (overall) averages across ALL dates, excluding zeros
      const cNonZero = unit.consumed.filter(v => v > 0)
      const pNonZero = unit.produced.filter(v => v > 0)
      const cAvg = cNonZero.length > 0 ? cNonZero.reduce((a, b) => a + b, 0) / cNonZero.length : 0
      const pAvg = pNonZero.length > 0 ? pNonZero.reduce((a, b) => a + b, 0) / pNonZero.length : 0

      unitMeta.push({ name: unit.name, code: unit.code, unitIndex })

      rows.push({
        label: unit.name,
        subLabel: 'загрузка',
        code: unit.code,
        type: 'consumed',
        unitIndex,
        values: unit.consumed,
        avg: cAvg,
        ratios: unit.consumed.map(v => v === 0 ? null : computeRatio(v, cAvg)),
      })
      rows.push({
        label: '',
        subLabel: 'выпуск',
        code: unit.code,
        type: 'produced',
        unitIndex,
        values: unit.produced,
        avg: pAvg,
        ratios: unit.produced.map(v => v === 0 ? null : computeRatio(v, pAvg)),
      })
    })

    return { dates, rows, unitMeta }
  }, [data])

  if (isLoading) return <div className="text-dark-muted text-sm">Загрузка тепловой карты...</div>
  if (!processed) return null

  const { dates, rows, unitMeta } = processed
  const totalW = LABEL_W + dates.length * CELL_W + 80
  const totalH = HEADER_H + rows.length * CELL_H + 10

  const formatDate = (iso) => {
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-dark-text mb-3">Тепловая карта загрузки</h3>
      <div className="overflow-x-auto relative" ref={containerRef}>
        <svg width={totalW} height={totalH} className="select-none">
          {/* Date headers */}
          {dates.map((d, ci) => (
            <text
              key={ci}
              x={LABEL_W + ci * CELL_W + CELL_W / 2}
              y={HEADER_H - 6}
              textAnchor="middle"
              fill="#64748b"
              fontSize={8}
              transform={`rotate(-45, ${LABEL_W + ci * CELL_W + CELL_W / 2}, ${HEADER_H - 6})`}
            >
              {formatDate(d)}
            </text>
          ))}

          {/* Rows */}
          {rows.map((row, ri) => {
            const y = HEADER_H + ri * CELL_H
            const isFirstOfUnit = row.type === 'consumed'
            return (
              <g key={ri}>
                {/* Unit name label (only for first sub-row) */}
                {isFirstOfUnit && (
                  <text
                    x={4}
                    y={y + CELL_H}
                    fill="#e2e8f0"
                    fontSize={10}
                    fontWeight={600}
                    dominantBaseline="middle"
                  >
                    {row.label.length > 22 ? row.label.slice(0, 20) + '...' : row.label}
                  </text>
                )}
                {/* Sub-label */}
                <text
                  x={LABEL_W - 6}
                  y={y + CELL_H / 2}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize={9}
                  dominantBaseline="middle"
                >
                  {row.subLabel}
                </text>

                {/* Cells — colored per unit palette */}
                {row.ratios.map((ratio, ci) => (
                  <rect
                    key={ci}
                    x={LABEL_W + ci * CELL_W}
                    y={y}
                    width={CELL_W - 1}
                    height={CELL_H - 1}
                    rx={2}
                    fill={ratio === null ? '#111827' : tempColor(ratio, row.unitIndex)}
                    opacity={ratio === null ? 0.3 : 0.85}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current.getBoundingClientRect()
                      setTooltip({
                        x: e.clientX - rect.left + 10,
                        y: e.clientY - rect.top - 40,
                        unit: rows[ri - (ri % 2)].label || row.code,
                        type: row.subLabel,
                        date: dates[ci],
                        value: row.values[ci],
                        avg: row.avg,
                        pct: row.avg > 0 ? ((row.values[ci] - row.avg) / row.avg * 100).toFixed(1) : '—',
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}

                {/* Yearly average value at end of row */}
                <text
                  x={LABEL_W + dates.length * CELL_W + 6}
                  y={y + CELL_H / 2}
                  fill="#94a3b8"
                  fontSize={9}
                  dominantBaseline="middle"
                >
                  {'\u03BC'} {row.avg.toFixed(0)}
                </text>

                {/* Row separator between units */}
                {row.type === 'produced' && (
                  <line
                    x1={LABEL_W}
                    x2={LABEL_W + dates.length * CELL_W}
                    y1={y + CELL_H}
                    y2={y + CELL_H}
                    stroke="#1e293b"
                    strokeWidth={1}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip — light background */}
        {tooltip && (
          <div
            className="absolute z-50 border rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              backgroundColor: '#f8fafc',
              borderColor: '#cbd5e1',
              color: '#1e293b',
            }}
          >
            <div className="font-semibold">{tooltip.unit}</div>
            <div className="text-gray-500">{tooltip.date} / {tooltip.type}</div>
            <div className="mt-1 tabular-nums font-medium">{tooltip.value.toFixed(1)} т</div>
            <div className="text-gray-500 tabular-nums">
              Среднее за период: {tooltip.avg.toFixed(1)} т ({tooltip.pct}%)
            </div>
          </div>
        )}
      </div>

      {/* Per-unit legend with individual gradient bands */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-4 text-xs text-dark-muted">
          <span className="shrink-0">Шкала по установкам:</span>
          <span className="text-dark-muted">ниже среднего</span>
          <span className="mx-auto" />
          <span className="text-dark-muted">выше среднего</span>
        </div>
        {unitMeta.map((um) => (
          <div key={um.unitIndex} className="flex items-center gap-2 text-xs text-dark-muted">
            <span
              className="shrink-0 text-right"
              style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={um.name}
            >
              {um.name.length > 20 ? um.name.slice(0, 18) + '...' : um.name}
            </span>
            <div
              className="h-3 rounded flex-1"
              style={{
                minWidth: 120,
                maxWidth: 200,
                background: `linear-gradient(to right, ${buildGradientStops(um.unitIndex)})`,
              }}
            />
          </div>
        ))}
        <div className="flex items-center gap-1 text-xs text-dark-muted mt-1">
          <div className="w-4 h-3 rounded" style={{ backgroundColor: '#111827', opacity: 0.3 }} />
          <span>нет данных</span>
        </div>
      </div>
    </div>
  )
}
