import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts'

export default function ControlChart({ spcData }) {
  if (!spcData || !spcData.dates || spcData.dates.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для SPC</div>
  }

  const { dates, values, mean, sigma } = spcData
  const data = dates.map((d, i) => ({
    date: d.slice(5),
    value: values[i],
    zone: Math.abs(values[i] - mean) / (sigma || 1),
  }))

  const s1 = sigma
  const s2 = sigma * 2
  const s3 = sigma * 3

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 text-dark-text">SPC Контрольная карта</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          {sigma > 0 && (
            <>
              <ReferenceArea y1={mean - s3} y2={mean - s2} fill="#f87171" fillOpacity={0.05} />
              <ReferenceArea y1={mean - s2} y2={mean - s1} fill="#f59e0b" fillOpacity={0.05} />
              <ReferenceArea y1={mean - s1} y2={mean + s1} fill="#4ade80" fillOpacity={0.05} />
              <ReferenceArea y1={mean + s1} y2={mean + s2} fill="#f59e0b" fillOpacity={0.05} />
              <ReferenceArea y1={mean + s2} y2={mean + s3} fill="#f87171" fillOpacity={0.05} />
            </>
          )}
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0c1529', border: '1px solid #1e293b', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#3b82f6' }}
          />
          <ReferenceLine y={mean} stroke="#4ade80" strokeDasharray="5 5" label={{ value: 'μ', fill: '#4ade80', fontSize: 11 }} />
          {sigma > 0 && (
            <>
              <ReferenceLine y={mean + s2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '+2σ', fill: '#f59e0b', fontSize: 10 }} />
              <ReferenceLine y={mean - s2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '-2σ', fill: '#f59e0b', fontSize: 10 }} />
              <ReferenceLine y={mean + s3} stroke="#f87171" strokeDasharray="3 3" label={{ value: '+3σ', fill: '#f87171', fontSize: 10 }} />
              <ReferenceLine y={mean - s3} stroke="#f87171" strokeDasharray="3 3" label={{ value: '-3σ', fill: '#f87171', fontSize: 10 }} />
            </>
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={({ cx, cy, payload }) => {
              const z = payload.zone
              const color = z > 3 ? '#f87171' : z > 2 ? '#f59e0b' : '#3b82f6'
              return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke={color} />
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-dark-muted">
        <span>μ = {mean.toFixed(1)} т</span>
        <span>σ = {sigma.toFixed(1)} т</span>
      </div>
    </div>
  )
}
