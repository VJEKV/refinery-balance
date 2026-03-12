import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useRef } from 'react'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'

/** Load/production color: 13 steps, 10% intervals. 100% = max green */
function colorForLoadPct(pct) {
  const stops = [
    [0,   0x4c, 0x05, 0x19],
    [10,  0x7f, 0x1d, 0x1d],
    [20,  0xb9, 0x1c, 0x1c],
    [30,  0xdc, 0x26, 0x26],
    [40,  0xea, 0x58, 0x0c],
    [50,  0xf5, 0x9e, 0x0b],
    [60,  0xea, 0xb3, 0x08],
    [70,  0x84, 0xcc, 0x16],
    [80,  0x22, 0xc5, 0x5e],
    [90,  0x16, 0xa3, 0x4a],
    [100, 0x15, 0x80, 0x3d],
    [110, 0x63, 0x66, 0xf1],
    [120, 0x7c, 0x3a, 0xed],
  ]
  const clamped = Math.max(0, Math.min(130, pct))
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      lo = stops[i]; hi = stops[i + 1]; break
    }
  }
  if (clamped > 120) { lo = stops[stops.length - 2]; hi = stops[stops.length - 1] }
  const range = hi[0] - lo[0] || 1
  const t = (clamped - lo[0]) / range
  const r = Math.round(lo[1] + (hi[1] - lo[1]) * t)
  const g = Math.round(lo[2] + (hi[2] - lo[2]) * t)
  const b = Math.round(lo[3] + (hi[3] - lo[3]) * t)
  return `rgb(${r},${g},${b})`
}

/** Imbalance color: 6 steps, 5% intervals */
function colorForImbalancePct(pct) {
  const absPct = Math.abs(pct)
  const stops = [
    [0,  0x15, 0x80, 0x3d],
    [5,  0x65, 0xa3, 0x0d],
    [10, 0xea, 0xb3, 0x08],
    [15, 0xf5, 0x9e, 0x0b],
    [20, 0xea, 0x58, 0x0c],
    [25, 0xdc, 0x26, 0x26],
  ]
  const clamped = Math.min(30, absPct)
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      lo = stops[i]; hi = stops[i + 1]; break
    }
  }
  if (clamped > 25) { lo = stops[stops.length - 2]; hi = stops[stops.length - 1] }
  const range = hi[0] - lo[0] || 1
  const t = (clamped - lo[0]) / range
  const r = Math.round(lo[1] + (hi[1] - lo[1]) * t)
  const g = Math.round(lo[2] + (hi[2] - lo[2]) * t)
  const b = Math.round(lo[3] + (hi[3] - lo[3]) * t)
  return `rgb(${r},${g},${b})`
}

function textOnBg(pct, type) {
  if (type === 'imbalance') {
    return Math.abs(pct) < 8 ? '#1e293b' : '#ffffff'
  }
  if (pct <= 0) return '#fca5a5'
  if (pct >= 60 && pct <= 100) return '#ffffff'
  if (pct > 100) return '#ffffff'
  if (pct < 40) return '#fca5a5'
  return '#1e293b'
}

function formatDay(iso) {
  const d = new Date(iso)
  return d.getDate().toString().padStart(2, '0')
}

function fmtTons(v) {
  return Math.abs(v) < 0.5 ? '0' : Math.round(v).toLocaleString('ru-RU')
}

export default function HeatmapChart() {
  const { dateParams } = useDateFilter()
  const [mode, setMode] = useState('tons')
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['heatmap', dateParams],
    queryFn: () => api.get('/analytics/heatmap', { params: dateParams }).then(r => r.data),
  })

  const processed = useMemo(() => {
    if (!data || !data.dates || data.dates.length === 0) return null
    return data.units.map(unit => {
      const cNonZero = unit.consumed.filter(v => v > 0)
      const pNonZero = unit.produced.filter(v => v > 0)
      const avgC = cNonZero.length > 0 ? cNonZero.reduce((a, b) => a + b, 0) / cNonZero.length : 0
      const avgP = pNonZero.length > 0 ? pNonZero.reduce((a, b) => a + b, 0) / pNonZero.length : 0
      const sumC = unit.consumed.reduce((a, b) => a + b, 0)
      const sumP = unit.produced.reduce((a, b) => a + b, 0)
      const sumImb = sumC - sumP
      const imbalance = unit.consumed.map((c, i) => c - (unit.produced[i] || 0))
      const imbPct = unit.consumed.map((c, i) => c > 0 ? Math.abs(c - (unit.produced[i] || 0)) / c * 100 : 0)
      const cPct = unit.consumed.map(c => avgC > 0 ? c / avgC * 100 : 0)
      const pPct = unit.produced.map(p => avgP > 0 ? p / avgP * 100 : 0)
      return {
        ...unit,
        avgC, avgP, sumC, sumP, sumImb,
        imbalance, imbPct, cPct, pPct,
      }
    })
  }, [data])

  if (isLoading) return <div className="text-dark-muted text-sm">Загрузка тепловой карты...</div>
  if (!processed || processed.length === 0) return null

  const dates = data.dates

  const handleMouse = (e, unit, di, rowType) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cr = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    const c = unit.consumed[di] || 0
    const p = unit.produced[di] || 0
    const imb = c - p
    const imbP = c > 0 ? (imb / c * 100) : 0
    const planC = unit.plan_day_input || 0
    const planP = unit.plan_day_output || 0
    setTooltip({
      x: rect.left - cr.left + rect.width / 2,
      y: rect.top - cr.top - 8,
      unitName: unit.name,
      date: dates[di],
      rowType,
      consumed: c, produced: p,
      imbalance: imb, imbPct: imbP,
      planC, planP,
      cPct: unit.cPct[di], pPct: unit.pPct[di],
    })
  }

  return (
    <div className="space-y-4" ref={containerRef}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">Тепловая карта загрузки</h3>
        <div className="flex rounded-lg border border-dark-border overflow-hidden">
          <button
            onClick={() => setMode('tons')}
            className={`px-3 py-1 text-xs transition-colors ${mode === 'tons' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'}`}
          >
            тонны
          </button>
          <button
            onClick={() => setMode('pct')}
            className={`px-3 py-1 text-xs transition-colors ${mode === 'pct' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'}`}
          >
            %
          </button>
        </div>
      </div>

      {processed.map((unit, ui) => (
        <div key={unit.code} className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-bold text-dark-text">{unit.name}</h4>
            <div className="text-xs text-dark-muted tabular-nums">
              Σ загрузка: <span className="text-dark-text font-semibold">{fmtTons(unit.sumC)} т</span>
              {' · '}
              выпуск: <span className="text-dark-text font-semibold">{fmtTons(unit.sumP)} т</span>
              {' · '}
              дисбаланс: <span className="text-accent-red font-semibold">{fmtTons(unit.sumImb)} т</span>
            </div>
          </div>

          <div className="overflow-x-auto relative">
            <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '80px', minWidth: '80px' }} />
                {dates.map((_, i) => <col key={i} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left text-[10px] text-dark-muted font-normal px-1 py-1" />
                  {dates.map((d, i) => (
                    <th key={i} className="text-center text-[10px] text-dark-muted font-normal px-0 py-1">
                      {formatDay(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Загрузка */}
                <tr>
                  <td className="text-[11px] text-dark-muted px-1 py-0 font-medium">загрузка</td>
                  {dates.map((_, di) => {
                    const v = unit.consumed[di] || 0
                    const pct = unit.cPct[di]
                    const bg = v === 0 ? '#111827' : colorForLoadPct(pct)
                    const fg = v === 0 ? '#475569' : textOnBg(pct, 'load')
                    const display = mode === 'tons' ? fmtTons(v) : (v === 0 ? '0' : `${Math.round(pct)}%`)
                    return (
                      <td key={di}
                        className="text-center px-0 py-0 cursor-pointer border border-dark-bg/30"
                        style={{ backgroundColor: bg, color: fg, fontSize: '10px', fontVariantNumeric: 'tabular-nums', height: 28, fontWeight: 500 }}
                        onMouseEnter={e => handleMouse(e, unit, di, 'загрузка')}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
                {/* Выпуск */}
                <tr>
                  <td className="text-[11px] text-dark-muted px-1 py-0 font-medium">выпуск</td>
                  {dates.map((_, di) => {
                    const v = unit.produced[di] || 0
                    const pct = unit.pPct[di]
                    const bg = v === 0 ? '#111827' : colorForLoadPct(pct)
                    const fg = v === 0 ? '#475569' : textOnBg(pct, 'load')
                    const display = mode === 'tons' ? fmtTons(v) : (v === 0 ? '0' : `${Math.round(pct)}%`)
                    return (
                      <td key={di}
                        className="text-center px-0 py-0 cursor-pointer border border-dark-bg/30"
                        style={{ backgroundColor: bg, color: fg, fontSize: '10px', fontVariantNumeric: 'tabular-nums', height: 28, fontWeight: 500 }}
                        onMouseEnter={e => handleMouse(e, unit, di, 'выпуск')}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
                {/* Дисбаланс */}
                <tr>
                  <td className="text-[11px] text-dark-muted px-1 py-0 font-medium">дисбаланс</td>
                  {dates.map((_, di) => {
                    const c = unit.consumed[di] || 0
                    const imb = unit.imbalance[di] || 0
                    const imbP = unit.imbPct[di] || 0
                    const bg = c === 0 ? '#111827' : colorForImbalancePct(imbP)
                    const fg = c === 0 ? '#475569' : textOnBg(imbP, 'imbalance')
                    const display = mode === 'tons' ? fmtTons(imb) : (c === 0 ? '—' : `${imbP.toFixed(1)}%`)
                    return (
                      <td key={di}
                        className="text-center px-0 py-0 cursor-pointer border border-dark-bg/30"
                        style={{ backgroundColor: bg, color: fg, fontSize: '10px', fontVariantNumeric: 'tabular-nums', height: 28, fontWeight: 500 }}
                        onMouseEnter={e => handleMouse(e, unit, di, 'дисбаланс')}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 shadow-xl"
          style={{
            left: (containerRef.current?.getBoundingClientRect().left || 0) + tooltip.x,
            top: (containerRef.current?.getBoundingClientRect().top || 0) + tooltip.y,
            transform: 'translate(-50%, -100%)',
            fontSize: '11px',
            color: '#1e293b',
            whiteSpace: 'nowrap',
          }}
        >
          <div className="font-semibold">{tooltip.unitName}</div>
          <div className="text-gray-500">{new Date(tooltip.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} / {tooltip.rowType}</div>
          <div className="mt-1">Факт загрузка: <span className="font-medium">{fmtTons(tooltip.consumed)} т</span> ({Math.round(tooltip.cPct)}%)</div>
          <div>Факт выпуск: <span className="font-medium">{fmtTons(tooltip.produced)} т</span> ({Math.round(tooltip.pPct)}%)</div>
          {tooltip.planC > 0 && <div className="text-gray-500">План загрузка: {fmtTons(tooltip.planC)} т/день</div>}
          {tooltip.planP > 0 && <div className="text-gray-500">План выпуск: {fmtTons(tooltip.planP)} т/день</div>}
          <div className="font-semibold mt-0.5">
            Дисбаланс: {fmtTons(tooltip.imbalance)} т ({tooltip.imbPct.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  )
}
