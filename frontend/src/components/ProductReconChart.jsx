import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fmtDateShort } from '../utils/excelExport'

const PRODUCT_COLORS = [
  '#3b82f6', '#4ade80', '#f59e0b', '#f87171', '#a855f7',
  '#22d3ee', '#ec4899', '#84cc16', '#fb923c', '#818cf8',
  '#2dd4bf', '#f43f5e', '#d97706', '#06b6d4', '#a3e635',
]

export default function ProductReconChart({ productRecon, direction = 'inputs', resolved }) {
  const items = productRecon?.[direction] || []
  const dates = productRecon?.dates || []
  const [mode, setMode] = useState('pct') // 'pct' or 'tons'

  const { data, activeProducts } = useMemo(() => {
    if (items.length === 0 || dates.length === 0) return { data: [], activeProducts: [] }

    // Only products with meaningful data
    const active = items.filter(p =>
      p.gaps_pct.some(v => v > 0) || p.gaps_tons.some(v => v > 0)
    )

    const chartData = dates.map((d, i) => {
      const row = { date: fmtDateShort(d) }
      active.forEach(p => {
        const key = p.product.slice(0, 20)
        row[key] = mode === 'pct' ? p.gaps_pct[i] : p.gaps_tons[i]
      })
      return row
    })

    return { data: chartData, activeProducts: active }
  }, [items, dates, mode])

  if (activeProducts.length === 0) return null

  const colors = resolved?.colors
  const fontFamily = resolved?.fontFamily || "'Montserrat', sans-serif"
  const fontSize = resolved?.fontSize

  const label = direction === 'inputs' ? 'Сырьё' : 'Продукция'
  const unit = mode === 'pct' ? '%' : 'т'

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold text-dark-text"
          style={{ fontFamily, fontSize: fontSize?.title || 15 }}
        >
          Расхождение прибор/согл — {label}
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
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors?.grid || '#1e293b'} />
          <XAxis
            dataKey="date"
            tick={{ fill: colors?.muted || '#94a3b8', fontSize: fontSize?.axis || 11, fontFamily }}
          />
          <YAxis
            tick={{ fill: colors?.muted || '#94a3b8', fontSize: fontSize?.axis || 11, fontFamily }}
            unit={unit}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors?.tooltip?.bg || '#f8fafc',
              border: `1px solid ${colors?.tooltip?.border || '#cbd5e1'}`,
              borderRadius: 8,
              fontFamily,
              color: colors?.tooltip?.text || '#1e293b',
              maxHeight: 300,
              overflowY: 'auto',
            }}
            labelStyle={{ color: colors?.tooltip?.text || '#1e293b', fontWeight: 600 }}
            formatter={(v, name) => [`${v.toFixed(mode === 'pct' ? 2 : 1)}${unit}`, name]}
          />
          {activeProducts.map((p, idx) => {
            const key = p.product.slice(0, 20)
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PRODUCT_COLORS[idx % PRODUCT_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                name={p.product}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-dark-muted">
        {activeProducts.map((p, idx) => (
          <span key={idx} className="flex items-center gap-1">
            <span
              className="w-3 h-0.5 rounded"
              style={{ backgroundColor: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }}
            />
            <span className="truncate max-w-[180px]" title={p.product}>{p.product}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
