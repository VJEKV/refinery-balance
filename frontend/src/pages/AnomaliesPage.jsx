import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import EventLog from '../components/EventLog'
import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch } from 'lucide-react'

const methodConfig = {
  balance_closure: { label: 'Невязка МБ', icon: AlertTriangle, color: 'text-accent-red' },
  recon_gap: { label: 'Прибор/Согласов.', icon: BarChart3, color: 'text-accent-yellow' },
  spc: { label: 'SPC', icon: Activity, color: 'text-accent-blue' },
  cusum: { label: 'CUSUM', icon: TrendingUp, color: 'text-accent-purple' },
  downtime: { label: 'Простой', icon: Clock, color: 'text-dark-muted' },
  cross_unit: { label: 'Межцеховой', icon: GitBranch, color: 'text-accent-green' },
}

export default function AnomaliesPage() {
  const [filterMethod, setFilterMethod] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')

  const { data: summary } = useQuery({
    queryKey: ['anomalySummary'],
    queryFn: () => api.get('/anomalies/summary').then(r => r.data),
  })

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', filterMethod, filterSeverity],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filterMethod) params.set('method', filterMethod)
      if (filterSeverity) params.set('severity', filterSeverity)
      return api.get(`/anomalies?${params}`).then(r => r.data)
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Аномалии</h1>

      <div className="grid grid-cols-6 gap-4">
        {Object.entries(methodConfig).map(([key, cfg]) => {
          const Icon = cfg.icon
          const s = summary?.[key] || { total: 0, critical: 0, warn: 0 }
          return (
            <button
              key={key}
              onClick={() => setFilterMethod(filterMethod === key ? '' : key)}
              className={`bg-dark-card border rounded-xl p-4 text-left transition-colors ${
                filterMethod === key ? 'border-accent-blue' : 'border-dark-border hover:border-dark-muted'
              }`}
            >
              <Icon size={18} className={cfg.color} />
              <div className="text-xs text-dark-muted mt-2">{cfg.label}</div>
              <div className="text-xl font-bold text-dark-text mt-1">{s.total}</div>
              <div className="flex gap-2 mt-1 text-xs">
                {s.critical > 0 && <span className="text-accent-red">{s.critical} крит.</span>}
                {s.warn > 0 && <span className="text-accent-yellow">{s.warn} пред.</span>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 items-center">
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text"
        >
          <option value="">Все уровни</option>
          <option value="critical">Критично</option>
          <option value="warn">Внимание</option>
        </select>
        {(filterMethod || filterSeverity) && (
          <button
            onClick={() => { setFilterMethod(''); setFilterSeverity('') }}
            className="text-xs text-accent-blue hover:underline"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <EventLog anomalies={anomalies || []} />
      </div>
    </div>
  )
}
