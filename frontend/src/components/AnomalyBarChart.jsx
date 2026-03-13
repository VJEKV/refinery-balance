import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

const METHOD_LABELS = {
  balance_closure: 'Небаланс вход/выход',
  recon_gap: 'Расхождение измерено/согласовано',
  spc: 'Нетипичные дни',
  cusum: 'Скрытый тренд',
  downtime: 'Простой',
  cross_unit: 'Потери продукции между установками',
}

const METHOD_COLORS = {
  balance_closure: '#f87171',
  recon_gap: '#f59e0b',
  spc: '#3b82f6',
  cusum: '#a855f7',
  downtime: '#64748b',
  cross_unit: '#22d3ee',
}

export default function AnomalyBarChart({ anomalies = [] }) {
  const chartData = useMemo(() => {
    if (!anomalies || anomalies.length === 0) return []

    // Group by unit: count anomalies and sum deviation values
    const unitMap = {}
    anomalies.forEach(a => {
      const unitKey = a.unit_name || a.unit || 'Неизвестно'
      if (!unitMap[unitKey]) {
        unitMap[unitKey] = { unit: unitKey, count: 0, totalValue: 0, methods: {} }
      }
      unitMap[unitKey].count++
      // Value is typically in % — convert to meaningful deviation
      // For cross_unit, value = loss %, output_value and input_value available
      // For others, value is the metric value
      const tons = a.output_value ? Math.abs(a.output_value - (a.input_value || 0)) : 0
      unitMap[unitKey].totalValue += tons

      const method = a.method || 'other'
      if (!unitMap[unitKey].methods[method]) {
        unitMap[unitKey].methods[method] = 0
      }
      unitMap[unitKey].methods[method]++
    })

    return Object.values(unitMap)
      .sort((a, b) => b.count - a.count)
  }, [anomalies])

  // Build stacked data for method breakdown
  const stackedData = useMemo(() => {
    if (chartData.length === 0) return []
    return chartData.map(d => {
      const row = { unit: d.unit.length > 18 ? d.unit.slice(0, 16) + '...' : d.unit, total: d.count }
      Object.keys(METHOD_LABELS).forEach(m => {
        row[m] = d.methods[m] || 0
      })
      return row
    })
  }, [chartData])

  if (stackedData.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет аномалий для отображения</div>
  }

  const allMethods = Object.keys(METHOD_LABELS).filter(m =>
    stackedData.some(d => d[m] > 0)
  )

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <h3 className="text-lg font-bold text-dark-text mb-3">Аномалии по установкам и методам</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, stackedData.length * 50 + 60)}>
        <BarChart
          data={stackedData}
          layout="vertical"
          margin={{ top: 5, right: 30, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#cbd5e1', fontSize: 14 }} />
          <YAxis
            dataKey="unit"
            type="category"
            width={180}
            tick={{ fill: '#e2e8f0', fontSize: 14 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              color: '#1e293b',
            }}
            labelStyle={{ color: '#1e293b', fontWeight: 600 }}
            formatter={(v, name) => [v, METHOD_LABELS[name] || name]}
          />
          {allMethods.map(method => (
            <Bar
              key={method}
              dataKey={method}
              stackId="anomalies"
              fill={METHOD_COLORS[method] || '#64748b'}
              radius={0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-sm text-dark-muted">
        {allMethods.map(m => (
          <span key={m} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: METHOD_COLORS[m] }} />
            {METHOD_LABELS[m]}
          </span>
        ))}
      </div>
    </div>
  )
}
