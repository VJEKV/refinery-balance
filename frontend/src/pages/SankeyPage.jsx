import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import SankeyDiagram from '../components/SankeyDiagram'
import ChartWrapper from '../components/ChartWrapper'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useDateFilter } from '../hooks/useDateFilter'

export default function SankeyPage() {
  const [dataType, setDataType] = useState('reconciled')
  const [period, setPeriod] = useState('daily')
  const { dateParams } = useDateFilter()

  const { data: overview } = useQuery({
    queryKey: ['overview', dateParams],
    queryFn: () => api.get('/analytics/overview', { params: dateParams }).then(r => r.data),
  })

  const dates = useMemo(() => overview?.dates || [], [overview])
  const [dateIdx, setDateIdx] = useState(null)
  const activeIdx = dateIdx ?? (dates.length - 1)
  const activeDate = dates[activeIdx] || ''

  const prevDate = () => setDateIdx(Math.max(0, (dateIdx ?? dates.length - 1) - 1))
  const nextDate = () => setDateIdx(Math.min(dates.length - 1, (dateIdx ?? dates.length - 1) + 1))

  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const sankeyUrl = (() => {
    if (!activeDate) return null
    if (period === 'monthly') {
      const d = new Date(activeDate)
      return `/sankey/monthly?year=${d.getFullYear()}&month=${d.getMonth() + 1}&type=${dataType}`
    }
    return `/sankey?date=${activeDate}&type=${dataType}`
  })()

  const { data: sankeyData, isLoading } = useQuery({
    queryKey: ['sankey', activeDate, dataType, period],
    queryFn: () => api.get(sankeyUrl).then(r => r.data),
    enabled: !!sankeyUrl,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Потоки (Sankey)</h1>

      {/* Controls */}
      <div className="flex gap-4 items-center flex-wrap">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevDate}
            disabled={activeIdx <= 0}
            className="p-1.5 rounded bg-dark-card border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-dark-text min-w-[180px] text-center">
            {formatDate(activeDate)}
          </span>
          <button
            onClick={nextDate}
            disabled={activeIdx >= dates.length - 1}
            className="p-1.5 rounded bg-dark-card border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Period toggle */}
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text"
        >
          <option value="daily">Сутки</option>
          <option value="monthly">Месяц</option>
        </select>

        {/* Data type toggle */}
        <div className="flex rounded-lg border border-dark-border overflow-hidden">
          <button
            onClick={() => setDataType('measured')}
            className={`px-3 py-1.5 text-sm transition-colors ${
              dataType === 'measured' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'
            }`}
          >
            Измеренное
          </button>
          <button
            onClick={() => setDataType('reconciled')}
            className={`px-3 py-1.5 text-sm transition-colors ${
              dataType === 'reconciled' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'
            }`}
          >
            Согласованное
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-dark-muted">Загрузка...</div>
      ) : (
        <ChartWrapper chartId="sankey" title="" className="overflow-x-auto">
          {(resolved) => <SankeyDiagram sankeyData={sankeyData} resolved={resolved} />}
        </ChartWrapper>
      )}

      {/* Losses table */}
      {sankeyData?.losses && sankeyData.losses.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border">
            <h2 className="text-sm font-semibold text-dark-text">Потери продукции между установками</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-dark-muted text-xs">
                  <th className="px-4 py-2 border border-dark-border/40">Откуда</th>
                  <th className="px-3 py-2 border border-dark-border/40">Куда</th>
                  <th className="px-3 py-2 border border-dark-border/40">Продукт</th>
                  <th className="px-3 py-2 border border-dark-border/40 text-right">Выход (т)</th>
                  <th className="px-3 py-2 border border-dark-border/40 text-right">Вход (т)</th>
                  <th className="px-3 py-2 border border-dark-border/40 text-right">Потери (т)</th>
                  <th className="px-3 py-2 border border-dark-border/40 text-right">Потери %</th>
                </tr>
              </thead>
              <tbody>
                {sankeyData.losses.map((l, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="px-4 py-2 border border-dark-border/20 text-dark-text">{l.source}</td>
                    <td className="px-3 py-2 border border-dark-border/20 text-dark-text">{l.target}</td>
                    <td className="px-3 py-2 border border-dark-border/20 text-dark-muted">{l.product}</td>
                    <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums text-dark-text">{l.output_value.toFixed(1)}</td>
                    <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums text-dark-text">{l.input_value.toFixed(1)}</td>
                    <td className={`px-3 py-2 border border-dark-border/20 text-right tabular-nums ${l.loss > 0 ? 'text-accent-red' : 'text-accent-green'}`}>
                      {l.loss > 0 ? '+' : ''}{l.loss.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums text-dark-muted">{l.loss_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
