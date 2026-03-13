import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { X } from 'lucide-react'
import InfoTooltip from './InfoTooltip'

const CELL_MIN_H = 25

/** Fixed color scale: green → yellow → red → dark maroon */
function getHeatColor(pct) {
  if (pct <= 0) return '#064e3b'
  if (pct <= 2) {
    const t = pct / 2
    return lerpColor('#064e3b', '#16a34a', t)
  }
  if (pct <= 5) {
    const t = (pct - 2) / 3
    return lerpColor('#eab308', '#f59e0b', t)
  }
  if (pct <= 15) {
    const t = (pct - 5) / 10
    return lerpColor('#f59e0b', '#dc2626', t)
  }
  // >15%: red → dark maroon (DARKENS, not lightens)
  const t = Math.min((pct - 15) / 15, 1)
  return lerpColor('#dc2626', '#4c0519', t)
}

function lerpColor(a, b, t) {
  const parse = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const [r1, g1, b1] = parse(a)
  const [r2, g2, b2] = parse(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${bl})`
}

function textColor(bgPct) {
  if (bgPct <= 1) return '#a7f3d0'
  if (bgPct <= 4) return '#1e293b'
  return '#ffffff'
}

function formatDay(dateStr) {
  const d = new Date(dateStr)
  return d.getDate()
}

export default function ReconHeatmap({ unitCode, direction, title, dateParams = {} }) {
  const [mode, setMode] = useState('pct')
  const [tooltip, setTooltip] = useState(null)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const containerRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['product-heatmap', unitCode, direction, dateParams],
    queryFn: () =>
      api.get('/analytics/product-heatmap', {
        params: { unit: unitCode, direction, ...dateParams },
      }).then(r => r.data),
    enabled: !!unitCode,
  })

  // All available products
  const allProducts = useMemo(() => data?.products || [], [data])

  const sorted = useMemo(() => {
    if (!data || !data.products?.length) return null
    const indices = data.products.map((_, i) => i)
    indices.sort((a, b) => {
      const avgA = data.values[a].reduce((s, v) => s + v.delta_pct, 0) / data.values[a].length
      const avgB = data.values[b].reduce((s, v) => s + v.delta_pct, 0) / data.values[b].length
      return avgB - avgA
    })
    return {
      products: indices.map(i => data.products[i]),
      dates: data.dates,
      values: indices.map(i => data.values[i]),
    }
  }, [data])

  // Apply product filter
  const filtered = useMemo(() => {
    if (!sorted) return null
    if (selectedProducts.length === 0) return sorted
    const keep = new Set(selectedProducts)
    const indices = sorted.products.map((_, i) => i).filter(i => keep.has(sorted.products[i]))
    if (indices.length === 0) return sorted
    return {
      products: indices.map(i => sorted.products[i]),
      dates: sorted.dates,
      values: indices.map(i => sorted.values[i]),
    }
  }, [sorted, selectedProducts])

  // Compute daily correction sums
  const daySums = useMemo(() => {
    if (!filtered) return null
    const { dates, values } = filtered
    return dates.map((_, di) => {
      let sumTons = 0
      for (let pi = 0; pi < values.length; pi++) {
        const cell = values[pi][di]
        sumTons += cell.measured - cell.reconciled
      }
      return sumTons
    })
  }, [filtered])

  const toggleProduct = (p) => {
    setSelectedProducts(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  if (isLoading) return <div className="text-dark-muted text-sm py-2">Загрузка тепловой карты...</div>
  if (!filtered || filtered.products.length === 0) return null

  const { products, dates, values } = filtered
  const numProducts = products.length
  const cellH = numProducts <= 4 ? 36 : CELL_MIN_H

  const handleMouseEnter = (e, pi, di) => {
    const cell = values[pi][di]
    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    setTooltip({
      product: products[pi],
      date: dates[di],
      measured: cell.measured,
      reconciled: cell.reconciled,
      delta_tons: cell.delta_tons,
      delta_pct: cell.delta_pct,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    })
  }

  // Unselected products for dropdown
  const unselectedProducts = allProducts.filter(p => !selectedProducts.includes(p))

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-3 w-full" ref={containerRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-dark-text">
          {title}
          <InfoTooltip text="Расхождение: |замер − согласовано| / замер × 100%." />
        </h3>
        <div className="flex rounded-lg border border-dark-border overflow-hidden">
          <button
            onClick={() => setMode('pct')}
            className={`px-2.5 py-1 text-xs transition-colors ${
              mode === 'pct' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'
            }`}
          >
            %
          </button>
          <button
            onClick={() => setMode('tons')}
            className={`px-2.5 py-1 text-xs transition-colors ${
              mode === 'tons' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'
            }`}
          >
            тонны
          </button>
        </div>
      </div>

      {/* Product filter tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-dark-muted mr-1">Продукты:</span>
        {selectedProducts.map(p => (
          <span
            key={p}
            className="inline-flex items-center gap-1 bg-accent-blue/20 text-accent-blue border border-accent-blue/30 rounded-full px-2 py-0.5 text-xs"
          >
            {p}
            <button onClick={() => toggleProduct(p)} className="hover:text-white">
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="relative">
          <button
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className="text-xs text-dark-muted hover:text-dark-text border border-dark-border rounded-full px-2 py-0.5"
          >
            {selectedProducts.length === 0 ? 'Все (фильтр)' : '+ добавить'}
          </button>
          {tagDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-dark-card border border-dark-border rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[180px]">
              {selectedProducts.length > 0 && (
                <button
                  onClick={() => { setSelectedProducts([]); setTagDropdownOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-accent-blue hover:bg-white/5"
                >
                  Сбросить фильтр
                </button>
              )}
              {unselectedProducts.map(p => (
                <button
                  key={p}
                  onClick={() => { toggleProduct(p); setTagDropdownOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-dark-text hover:bg-white/5 truncate"
                >
                  {p}
                </button>
              ))}
              {unselectedProducts.length === 0 && (
                <div className="px-3 py-1.5 text-xs text-dark-muted">Все продукты выбраны</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-1 mb-2 text-[10px] text-dark-muted">
        <span>0%</span>
        <div className="flex h-3 rounded overflow-hidden" style={{ width: 120 }}>
          {[0, 1, 3, 7, 15, 25].map((v, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: getHeatColor(v) }} />
          ))}
        </div>
        <span>30%+</span>
      </div>

      <div className="overflow-x-auto relative w-full">
        <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '130px', minWidth: '130px' }} />
            {dates.map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="text-left text-[10px] text-dark-muted font-normal px-1 py-1 sticky left-0 bg-dark-card z-10">
                Продукт
              </th>
              {dates.map((d, i) => (
                <th key={i} className="text-center text-[10px] text-dark-muted font-normal px-0 py-1">
                  {formatDay(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product, pi) => (
              <tr key={pi}>
                <td
                  className="text-[11px] text-dark-text px-1 py-0 sticky left-0 bg-dark-card z-10 truncate"
                  style={{ height: cellH }}
                  title={product}
                >
                  {product}
                </td>
                {dates.map((_, di) => {
                  const cell = values[pi][di]
                  const pct = cell.delta_pct
                  const displayVal = mode === 'pct'
                    ? pct.toFixed(1)
                    : cell.delta_tons.toFixed(cell.delta_tons >= 100 ? 0 : 1)
                  const bg = getHeatColor(pct)
                  const fg = textColor(pct)

                  return (
                    <td
                      key={di}
                      className="text-center px-0 py-0 cursor-pointer border border-dark-bg/30"
                      style={{
                        backgroundColor: bg,
                        color: fg,
                        fontSize: '10px',
                        fontVariantNumeric: 'tabular-nums',
                        height: cellH,
                        fontWeight: pct > 5 ? 600 : 400,
                      }}
                      onMouseEnter={(e) => handleMouseEnter(e, pi, di)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {cell.measured === 0 && cell.reconciled === 0 ? '—' : displayVal}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Summary row */}
            {daySums && (
              <tr className="border-t border-dark-border">
                <td
                  className="text-[10px] text-dark-muted font-semibold px-1 py-1 sticky left-0 bg-dark-card z-10"
                  style={{ height: cellH }}
                >
                  Σ корр.
                </td>
                {daySums.map((sum, di) => {
                  const absSum = Math.abs(sum)
                  const color = sum === 0 ? '#64748b' : sum < 0 ? '#f87171' : '#f59e0b'
                  const sign = sum > 0 ? '+' : sum < 0 ? '\u2212' : ''
                  return (
                    <td
                      key={di}
                      className="text-center px-0 py-1 border border-dark-bg/30"
                      style={{
                        fontSize: '9px',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color,
                        height: cellH,
                        backgroundColor: 'rgba(15,23,42,0.5)',
                      }}
                    >
                      {absSum < 0.05 ? '0' : sign + absSum.toFixed(absSum >= 100 ? 0 : 1)}
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 pointer-events-none bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 shadow-lg"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              fontSize: '11px',
              color: '#1e293b',
              whiteSpace: 'nowrap',
            }}
          >
            <div className="font-semibold mb-1">{tooltip.product}</div>
            <div>Дата: {new Date(tooltip.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
            <div>Замер: {tooltip.measured.toFixed(1)} т</div>
            <div>Согл: {tooltip.reconciled.toFixed(1)} т</div>
            <div className="font-semibold mt-0.5">
              Δ: {tooltip.delta_tons.toFixed(1)} т ({tooltip.delta_pct.toFixed(1)}%)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
