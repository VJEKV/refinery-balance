import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function ControlChart({ spcData, resolved }) {
  const [showHelp, setShowHelp] = useState(false)

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

  // Count violations
  const violations2s = data.filter(d => d.zone > 2 && d.zone <= 3).length
  const violations3s = data.filter(d => d.zone > 3).length

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

      {/* Stats + help toggle */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-4 text-xs text-dark-muted" style={{ fontFamily }}>
          <span>μ = {mean.toFixed(1)} т</span>
          <span>σ = {sigma.toFixed(1)} т</span>
          {violations3s > 0 && <span className="text-accent-red">За ±3σ: {violations3s} дн.</span>}
          {violations2s > 0 && <span className="text-accent-yellow">За ±2σ: {violations2s} дн.</span>}
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
          <p className="font-semibold text-dark-text">Как считается SPC (контрольная карта)</p>
          <p>
            Для каждого дня рассчитывается дебаланс установки (вход − выход) в тоннах.
            Среднее значение (μ) и стандартное отклонение (σ) вычисляются по всему периоду.
          </p>
          <p>
            <span className="text-accent-green">Зелёная зона (±1σ)</span> — нормальная вариация процесса.<br/>
            <span className="text-accent-yellow">Жёлтая зона (±2σ)</span> — повышенное отклонение, требует внимания.<br/>
            <span className="text-accent-red">Красная зона (±3σ)</span> — критическое отклонение, вероятна аномалия.
          </p>
          <p className="font-semibold text-accent-yellow">Риски</p>
          <p>
            Точки за ±3σ указывают на возможные утечки, ошибки приборов, нештатные режимы.
            Серии из 7+ точек по одну сторону от μ — скрытый сдвиг процесса.
          </p>
          <p className="font-semibold text-accent-blue">Что запросить</p>
          <p>
            Акты калибровки приборов учёта за дни с выбросами.
            Журнал технологических режимов. Сводку по ремонтам.
          </p>
        </div>
      )}
    </>
  )
}
