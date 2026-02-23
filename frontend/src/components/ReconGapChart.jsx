import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

function TonnageLabel({ x, y, width, height, value }) {
  if (value == null || height < 18) return null
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fontSize={10}
      fill="#a1a1aa"
    >
      {value >= 1000 ? `${(value / 1000).toFixed(1)}кт` : `${value.toFixed(1)}т`}
    </text>
  )
}

export default function ReconGapChart({ reconData, threshold = 5, resolved }) {
  if (!reconData || !reconData.dates || reconData.dates.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для ReconGap</div>
  }

  const { colors, fontFamily, fontSize } = resolved
  const hasTons = Array.isArray(reconData.gaps_tons)

  const data = reconData.dates.map((d, i) => ({
    date: d.slice(5),
    gap: reconData.gaps[i],
    tons: hasTons ? reconData.gaps_tons[i] : undefined,
  }))

  const tickStyle = { fill: colors.muted, fontSize: fontSize.axis, fontFamily }
  const refLabelSmall = fontSize.axis - 1

  const formatTooltip = (v, _name, entry) => {
    const pct = `${v.toFixed(2)}%`
    const tons = entry?.payload?.tons
    if (tons != null) {
      const tonsStr = tons >= 1000 ? `${(tons / 1000).toFixed(1)} кт` : `${tons.toFixed(1)} т`
      return [`${pct} (${tonsStr})`, 'Δ']
    }
    return [pct, 'Δ']
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="date" tick={tickStyle} />
          <YAxis tick={tickStyle} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tooltip.bg, border: `1px solid ${colors.tooltip.border}`, borderRadius: 8, fontFamily, color: colors.tooltip.text }}
            labelStyle={{ color: colors.tooltip.text }}
            formatter={formatTooltip}
            itemStyle={{ color: colors.tooltip.muted }}
          />
          <ReferenceLine y={3} stroke={colors.warning} strokeDasharray="5 5" label={{ value: '3%', fill: colors.warning, fontSize: refLabelSmall, fontFamily }} />
          <ReferenceLine y={threshold} stroke={colors.danger} strokeDasharray="5 5" label={{ value: `${threshold}%`, fill: colors.danger, fontSize: refLabelSmall, fontFamily }} />
          <Bar
            dataKey="gap"
            radius={[4, 4, 0, 0]}
            label={hasTons ? <TonnageLabel /> : false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.gap > threshold ? colors.danger : entry.gap > 3 ? colors.warning : colors.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}
