import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import KPICard from '../components/KPICard'
import UnitCard from '../components/UnitCard'
import HeatmapChart from '../components/HeatmapChart'
import AnomalyBarChart from '../components/AnomalyBarChart'
import { useDateFilter } from '../hooks/useDateFilter'
import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch } from 'lucide-react'

const methodConfig = {
  balance_closure: { label: 'Потери и утечки', icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/10' },
  recon_gap: { label: 'Расхождение замер/отчёт', icon: BarChart3, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  spc: { label: 'Выход за норму', icon: Activity, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
  cusum: { label: 'Устойчивый сдвиг', icon: TrendingUp, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
  downtime: { label: 'Простой', icon: Clock, color: 'text-dark-muted', bg: 'bg-white/5' },
  cross_unit: { label: 'Между установками', icon: GitBranch, color: 'text-accent-green', bg: 'bg-accent-green/10' },
}

export default function OverviewPage() {
  const { dateParams } = useDateFilter()
  const [activeMethod, setActiveMethod] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['overview', dateParams],
    queryFn: () => api.get('/analytics/overview', { params: dateParams }).then(r => r.data),
  })

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', dateParams],
    queryFn: () => api.get('/anomalies', { params: dateParams }).then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['anomalySummary', dateParams],
    queryFn: () => api.get('/anomalies/summary', { params: dateParams }).then(r => r.data),
  })

  if (isLoading) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Нет данных. Загрузите файл .xlsm</div>

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Суммарный вход (согл)" value={data.total_in} unit="т" color="blue" />
        <KPICard label="Суммарный выход (согл)" value={data.total_out} unit="т" color="green" />
        <KPICard label="Среднее отклонение" value={data.imbalance} unit="%" color={data.imbalance > 3 ? 'red' : 'yellow'} />
        <KPICard label="Всего аномалий" value={data.anomaly_count} color={data.anomaly_count > 0 ? 'red' : 'green'} />
        <KPICard label="Простои (уст-дни)" value={data.downtime_count} color={data.downtime_count > 0 ? 'yellow' : 'green'} />
      </div>

      {/* Anomaly method cards — under KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(methodConfig).map(([key, cfg]) => {
          const Icon = cfg.icon
          const s = summary?.[key] || { total: 0, critical: 0, warn: 0 }
          const isActive = activeMethod === key
          return (
            <button
              key={key}
              onClick={() => setActiveMethod(isActive ? null : key)}
              className={`bg-dark-card border rounded-xl p-3 text-left transition-all ${
                isActive
                  ? 'border-accent-blue ring-1 ring-accent-blue/30'
                  : 'border-dark-border hover:border-dark-muted'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center mb-1.5`}>
                <Icon size={14} className={cfg.color} />
              </div>
              <div className="text-[11px] text-dark-muted">{cfg.label}</div>
              <div className="text-xl font-bold text-dark-text mt-0.5">{s.total}</div>
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

      {/* Active method label */}
      {activeMethod && (
        <div className="flex items-center gap-2 text-sm text-dark-muted">
          Фильтр: <span className="text-accent-blue font-medium">{methodConfig[activeMethod].label}</span>
          <button onClick={() => setActiveMethod(null)} className="text-xs text-accent-blue hover:underline ml-2">
            Сбросить
          </button>
        </div>
      )}

      {/* Units grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {data.units.map(u => (
          <UnitCard
            key={u.code}
            unit={u}
            anomalies={anomalies || []}
            activeMethod={activeMethod}
          />
        ))}
      </div>

      {/* Anomaly analytics */}
      <AnomalyBarChart anomalies={anomalies || []} />

      {/* Heatmap */}
      <HeatmapChart />
    </div>
  )
}
