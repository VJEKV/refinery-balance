import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import EventLog from '../components/EventLog'
import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch } from 'lucide-react'
import { useDateFilter } from '../hooks/useDateFilter'

const methodConfig = {
  balance_closure: { label: 'Невязка МБ', icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/10' },
  recon_gap: { label: 'Прибор/Согласов.', icon: BarChart3, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  spc: { label: 'SPC', icon: Activity, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
  cusum: { label: 'CUSUM', icon: TrendingUp, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
  downtime: { label: 'Простой', icon: Clock, color: 'text-dark-muted', bg: 'bg-white/5' },
  cross_unit: { label: 'Межцеховой', icon: GitBranch, color: 'text-accent-green', bg: 'bg-accent-green/10' },
}

export default function AnomaliesPage() {
  const [filterMethod, setFilterMethod] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const { dateParams } = useDateFilter()

  const { data: summary } = useQuery({
    queryKey: ['anomalySummary', dateParams],
    queryFn: () => api.get('/anomalies/summary', { params: dateParams }).then(r => r.data),
  })

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', filterMethod, filterSeverity, dateParams],
    queryFn: () => {
      const params = { ...dateParams }
      if (filterMethod) params.method = filterMethod
      if (filterSeverity) params.severity = filterSeverity
      return api.get('/anomalies', { params }).then(r => r.data)
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Аномалии</h1>

      {/* Method summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(methodConfig).map(([key, cfg]) => {
          const Icon = cfg.icon
          const s = summary?.[key] || { total: 0, critical: 0, warn: 0 }
          const isActive = filterMethod === key
          return (
            <button
              key={key}
              onClick={() => setFilterMethod(isActive ? '' : key)}
              className={`bg-dark-card border rounded-xl p-3 text-left transition-all ${
                isActive
                  ? 'border-accent-blue ring-1 ring-accent-blue/30'
                  : 'border-dark-border hover:border-dark-muted'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center mb-2`}>
                <Icon size={16} className={cfg.color} />
              </div>
              <div className="text-xs text-dark-muted">{cfg.label}</div>
              <div className="text-2xl font-bold text-dark-text mt-0.5">{s.total}</div>
              <div className="flex gap-2 mt-1 text-xs">
                {s.critical > 0 && (
                  <span className="text-accent-red flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                    {s.critical}
                  </span>
                )}
                {s.warn > 0 && (
                  <span className="text-accent-yellow flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
                    {s.warn}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text"
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

      {/* Event log */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <EventLog anomalies={anomalies || []} />
      </div>
    </div>
  )
}
