import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [showHelp, setShowHelp] = useState(false)

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

  // Stats
  const avgGap = data.reduce((s, d) => s + d.gap, 0) / data.length
  const maxGap = Math.max(...data.map(d => d.gap))
  const daysAboveThreshold = data.filter(d => d.gap > threshold).length

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

      {/* Stats + help */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-4 text-xs text-dark-muted" style={{ fontFamily }}>
          <span>Среднее: {avgGap.toFixed(1)}%</span>
          <span>Макс: {maxGap.toFixed(1)}%</span>
          {daysAboveThreshold > 0 && <span className="text-accent-red">Выше порога: {daysAboveThreshold} дн.</span>}
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1 text-xs text-dark-muted hover:text-accent-blue"
        >
          <Info size={13} />
          {showHelp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {showHelp && (
        <div className="mt-3 p-3 bg-dark-bg/50 border border-dark-border rounded-lg text-xs text-dark-muted space-y-2">
          <p className="font-semibold text-dark-text">Что показывает этот график</p>
          <p>
            Каждый столбик — это разница между тем, что показали приборы (замер), и тем, что указано
            в согласованном балансе (отчёт) за конкретный день.
            Расхождение = |замер − отчёт| / |замер| × 100%.
          </p>
          <p>
            <span className="text-accent-blue">До 3%</span> — нормально, небольшая погрешность приборов.<br/>
            <span className="text-accent-yellow">3–5%</span> — повышенное расхождение, стоит разобраться.<br/>
            <span className="text-accent-red">Выше {threshold}%</span> — серьёзная разница, нужно проверить данные.
          </p>
          <p className="font-semibold text-accent-yellow">На что обратить внимание</p>
          <p>
            Когда приборы показывают одно, а в отчёте — другое, это может значить:
            приборы нуждаются в проверке, данные были скорректированы вручную,
            или есть ошибки при вводе данных в систему.
          </p>
          <p className="font-semibold text-accent-blue">Что запросить</p>
          <p>
            Акты проверки приборов учёта. Журнал ручных корректировок данных.
            Протоколы согласования баланса за дни с высокими расхождениями.
          </p>
        </div>
      )}
    </>
  )
}
