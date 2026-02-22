import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import SankeyDiagram from '../components/SankeyDiagram'

export default function SankeyPage() {
  const [dataType, setDataType] = useState('reconciled')

  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  })

  const dates = overview?.dates || []
  const [selectedDate, setSelectedDate] = useState('')
  const activeDate = selectedDate || dates[dates.length - 1] || ''

  const { data: sankeyData, isLoading } = useQuery({
    queryKey: ['sankey', activeDate, dataType],
    queryFn: () => api.get(`/sankey?date=${activeDate}&type=${dataType}`).then(r => r.data),
    enabled: !!activeDate,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Потоки (Sankey)</h1>

      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={activeDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text"
        >
          {dates.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <div className="flex rounded-lg border border-dark-border overflow-hidden">
          <button
            onClick={() => setDataType('measured')}
            className={`px-3 py-2 text-sm ${dataType === 'measured' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted'}`}
          >
            Измеренное
          </button>
          <button
            onClick={() => setDataType('reconciled')}
            className={`px-3 py-2 text-sm ${dataType === 'reconciled' ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted'}`}
          >
            Согласованное
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-dark-muted">Загрузка...</div>
      ) : (
        <SankeyDiagram sankeyData={sankeyData} />
      )}

      {sankeyData?.losses && sankeyData.losses.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border">
            <h2 className="text-sm font-semibold text-dark-text">Потери на трассах</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-left text-dark-muted text-xs">
                  <th className="px-4 py-2">Откуда</th>
                  <th className="px-3 py-2">Куда</th>
                  <th className="px-3 py-2">Продукт</th>
                  <th className="px-3 py-2 text-right">Выход</th>
                  <th className="px-3 py-2 text-right">Вход</th>
                  <th className="px-3 py-2 text-right">Потери</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {sankeyData.losses.map((l, i) => (
                  <tr key={i} className="border-b border-dark-border/50">
                    <td className="px-4 py-2">{l.source}</td>
                    <td className="px-3 py-2">{l.target}</td>
                    <td className="px-3 py-2 text-dark-muted">{l.product}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.output_value}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.input_value}</td>
                    <td className={`px-3 py-2 text-right font-mono ${l.loss > 0 ? 'text-accent-red' : 'text-accent-green'}`}>
                      {l.loss > 0 ? '+' : ''}{l.loss}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-dark-muted">{l.loss_pct}%</td>
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
