import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function CusumChart({ cusumData, resolved }) {
  const [showHelp, setShowHelp] = useState(false)

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

  // Detect threshold breaches
  const breachDays = dates.filter((_, i) => s_plus[i] > H || s_minus[i] > H).length
  const maxSp = Math.max(...s_plus)
  const maxSm = Math.max(...s_minus)

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

      {/* Stats + help */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-4 text-xs" style={{ fontFamily, color: colors.muted }}>
          <span style={{ color: colors.secondary }}>S+ макс = {maxSp.toFixed(1)}</span>
          <span style={{ color: colors.warning }}>S- макс = {maxSm.toFixed(1)}</span>
          <span style={{ color: colors.danger }}>Порог H = {H}</span>
          {breachDays > 0 && <span className="text-accent-red">Превышений: {breachDays} дн.</span>}
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
          <p className="font-semibold text-dark-text">Как считается CUSUM (кумулятивная сумма)</p>
          <p>
            CUSUM накапливает отклонения дебаланса от среднего значения.
            S+ отслеживает положительный сдвиг (систематический рост), S- — отрицательный (систематическое снижение).
          </p>
          <p>
            Формула: S+(t) = max(0, S+(t-1) + (x(t) - μ) - k), где k — допуск (обычно 0.5σ).
            Когда S+ или S- пересекают порог H — зафиксирован устойчивый сдвиг процесса.
          </p>
          <p className="font-semibold text-accent-yellow">Риски</p>
          <p>
            Пересечение порога H означает, что процесс систематически сдвинулся — не случайный выброс, а тренд.
            Это может указывать на деградацию оборудования, изменение качества сырья или систематическую ошибку учёта.
          </p>
          <p className="font-semibold text-accent-blue">Что запросить</p>
          <p>
            Журнал замены/ремонта оборудования. Паспорта качества сырья за период.
            Графики ТО приборов учёта. Отчёт о поверке расходомеров.
          </p>
        </div>
      )}
    </>
  )
}
