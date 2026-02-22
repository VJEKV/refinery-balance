import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

export default function ReconGapChart({ reconData, threshold = 5 }) {
  if (!reconData || !reconData.dates || reconData.dates.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для ReconGap</div>
  }

  const data = reconData.dates.map((d, i) => ({
    date: d.slice(5),
    gap: reconData.gaps[i],
  }))

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 text-dark-text">Расхождение прибор / согласованное</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#0c1529', border: '1px solid #1e293b', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(v) => [`${v.toFixed(2)}%`, 'Δ']}
          />
          <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '3%', fill: '#f59e0b', fontSize: 10 }} />
          <ReferenceLine y={threshold} stroke="#f87171" strokeDasharray="5 5" label={{ value: `${threshold}%`, fill: '#f87171', fontSize: 10 }} />
          <Bar dataKey="gap" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.gap > threshold ? '#f87171' : entry.gap > 3 ? '#f59e0b' : '#3b82f6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
