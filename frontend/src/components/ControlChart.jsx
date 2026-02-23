import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts'

export default function ControlChart({ spcData, resolved }) {
  if (!spcData || !spcData.dates || spcData.dates.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для SPC</div>
  }

  const { colors, fontFamily, fontSize } = resolved
  const { dates, values, mean, sigma } = spcData
  const data = dates.map((d, i) => ({
    date: d.slice(5),
    value: values[i],
    zone: Math.abs(values[i] - mean) / (sigma || 1),
  }))

  const s1 = sigma
  const s2 = sigma * 2
  const s3 = sigma * 3
  const tickStyle = { fill: colors.muted, fontSize: fontSize.axis, fontFamily }
  const refLabelSmall = fontSize.axis - 1

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          {sigma > 0 && (
            <>
              <ReferenceArea y1={mean - s3} y2={mean - s2} fill={colors.danger} fillOpacity={0.05} />
              <ReferenceArea y1={mean - s2} y2={mean - s1} fill={colors.warning} fillOpacity={0.05} />
              <ReferenceArea y1={mean - s1} y2={mean + s1} fill={colors.success} fillOpacity={0.05} />
              <ReferenceArea y1={mean + s1} y2={mean + s2} fill={colors.warning} fillOpacity={0.05} />
              <ReferenceArea y1={mean + s2} y2={mean + s3} fill={colors.danger} fillOpacity={0.05} />
            </>
          )}
          <XAxis dataKey="date" tick={tickStyle} />
          <YAxis tick={tickStyle} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tooltip.bg, border: `1px solid ${colors.tooltip.border}`, borderRadius: 8, fontFamily, color: colors.tooltip.text }}
            labelStyle={{ color: colors.tooltip.text }}
            itemStyle={{ color: colors.tooltip.muted }}
          />
          <ReferenceLine y={mean} stroke={colors.success} strokeDasharray="5 5" label={{ value: 'μ', fill: colors.success, fontSize: fontSize.axis, fontFamily }} />
          {sigma > 0 && (
            <>
              <ReferenceLine y={mean + s2} stroke={colors.warning} strokeDasharray="3 3" label={{ value: '+2σ', fill: colors.warning, fontSize: refLabelSmall, fontFamily }} />
              <ReferenceLine y={mean - s2} stroke={colors.warning} strokeDasharray="3 3" label={{ value: '-2σ', fill: colors.warning, fontSize: refLabelSmall, fontFamily }} />
              <ReferenceLine y={mean + s3} stroke={colors.danger} strokeDasharray="3 3" label={{ value: '+3σ', fill: colors.danger, fontSize: refLabelSmall, fontFamily }} />
              <ReferenceLine y={mean - s3} stroke={colors.danger} strokeDasharray="3 3" label={{ value: '-3σ', fill: colors.danger, fontSize: refLabelSmall, fontFamily }} />
            </>
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors.primary}
            strokeWidth={2}
            dot={({ cx, cy, payload }) => {
              const z = payload.zone
              const color = z > 3 ? colors.danger : z > 2 ? colors.warning : colors.primary
              return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke={color} />
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-dark-muted" style={{ fontFamily }}>
        <span>μ = {mean.toFixed(1)} т</span>
        <span>σ = {sigma.toFixed(1)} т</span>
      </div>
    </>
  )
}
