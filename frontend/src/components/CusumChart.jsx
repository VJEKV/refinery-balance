import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

export default function CusumChart({ cusumData }) {
  if (!cusumData || !cusumData.dates || cusumData.dates.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для CUSUM</div>
  }

  const { dates, s_plus, s_minus, H } = cusumData
  const data = dates.map((d, i) => ({
    date: d.slice(5),
    'S+': s_plus[i],
    'S-': s_minus[i],
  }))

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 text-dark-text">CUSUM</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0c1529', border: '1px solid #1e293b', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <ReferenceLine y={H} stroke="#f87171" strokeDasharray="5 5" label={{ value: `H=${H}`, fill: '#f87171', fontSize: 10 }} />
          <Line type="monotone" dataKey="S+" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
          <Line type="monotone" dataKey="S-" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-dark-muted">
        <span className="text-accent-purple">S+ (верхний)</span>
        <span className="text-accent-yellow">S- (нижний)</span>
        <span className="text-accent-red">Порог H = {H}</span>
      </div>
    </div>
  )
}
