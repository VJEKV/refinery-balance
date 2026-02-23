import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

export default function CusumChart({ cusumData, resolved }) {
  if (!cusumData || !cusumData.dates || cusumData.dates.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для CUSUM</div>
  }

  const { colors, fontFamily, fontSize } = resolved
  const { dates, s_plus, s_minus, H } = cusumData
  const data = dates.map((d, i) => ({
    date: d.slice(5),
    'S+': s_plus[i],
    'S-': s_minus[i],
  }))

  const tickStyle = { fill: colors.muted, fontSize: fontSize.axis, fontFamily }

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="date" tick={tickStyle} />
          <YAxis tick={tickStyle} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tooltip.bg, border: `1px solid ${colors.tooltip.border}`, borderRadius: 8, fontFamily, color: colors.tooltip.text }}
            labelStyle={{ color: colors.tooltip.text }}
            itemStyle={{ color: colors.tooltip.muted }}
          />
          <ReferenceLine y={H} stroke={colors.danger} strokeDasharray="5 5" label={{ value: `H=${H}`, fill: colors.danger, fontSize: fontSize.axis - 1, fontFamily }} />
          <Line type="monotone" dataKey="S+" stroke={colors.secondary} strokeWidth={2} dot={{ fill: colors.secondary, r: 3 }} />
          <Line type="monotone" dataKey="S-" stroke={colors.warning} strokeWidth={2} dot={{ fill: colors.warning, r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs" style={{ fontFamily, color: colors.muted }}>
        <span style={{ color: colors.secondary }}>S+ (верхний)</span>
        <span style={{ color: colors.warning }}>S- (нижний)</span>
        <span style={{ color: colors.danger }}>Порог H = {H}</span>
      </div>
    </>
  )
}
