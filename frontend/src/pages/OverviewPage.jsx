import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import KPICard from '../components/KPICard'
import UnitCard from '../components/UnitCard'
import HeatmapChart from '../components/HeatmapChart'
import AnomalyBarChart from '../components/AnomalyBarChart'
import { useDateFilter } from '../hooks/useDateFilter'
import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch, ChevronDown, ChevronUp } from 'lucide-react'

const methodConfig = {
  balance_closure: { label: 'Небаланс вход/выход', icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/10' },
  recon_gap: { label: 'Расхождение измерено/согласовано', icon: BarChart3, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  spc: { label: 'Нетипичные дни', icon: Activity, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
  cusum: { label: 'Скрытый тренд', icon: TrendingUp, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
  downtime: { label: 'Простой', icon: Clock, color: 'text-dark-muted', bg: 'bg-white/5' },
  cross_unit: { label: 'Потери продукции между установками', icon: GitBranch, color: 'text-accent-green', bg: 'bg-accent-green/10' },
}

export default function OverviewPage() {
  const { dateParams } = useDateFilter()
  const [expandedMethod, setExpandedMethod] = useState(null)
  const [expandedUnit, setExpandedUnit] = useState(null)

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

  // Group anomalies by method -> unit
  const anomalyTree = useMemo(() => {
    if (!anomalies || !data) return {}
    const tree = {}
    anomalies.forEach(a => {
      if (!tree[a.method]) tree[a.method] = {}
      const unitKey = a.unit || a.unit_name || 'unknown'
      if (!tree[a.method][unitKey]) tree[a.method][unitKey] = { name: a.unit_name || unitKey, items: [] }
      tree[a.method][unitKey].items.push(a)
    })
    return tree
  }, [anomalies, data])

  if (isLoading) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Нет данных. Загрузите файл .xlsm</div>

  const toggleMethod = (key) => {
    setExpandedMethod(prev => prev === key ? null : key)
    setExpandedUnit(null)
  }

  const toggleUnit = (unitCode) => {
    setExpandedUnit(prev => prev === unitCode ? null : unitCode)
  }

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

      {/* Three-level accordion: Method → Units → Details */}
      <div className="space-y-3">
        {Object.entries(methodConfig).map(([key, cfg]) => {
          const Icon = cfg.icon
          const s = summary?.[key] || { total: 0, critical: 0, warn: 0 }
          const isMethodOpen = expandedMethod === key
          const unitGroups = anomalyTree[key] || {}
          const unitCount = Object.keys(unitGroups).length

          return (
            <div key={key} className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              {/* Level 1: Method card */}
              <button
                onClick={() => toggleMethod(key)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon size={16} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-dark-text">{cfg.label}</div>
                  <div className="flex gap-3 mt-0.5 text-xs">
                    <span className="text-dark-muted">Всего: {s.total}</span>
                    {s.critical > 0 && (
                      <span className="text-accent-red flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                        {s.critical} критично
                      </span>
                    )}
                    {s.warn > 0 && (
                      <span className="text-accent-yellow flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
                        {s.warn} внимание
                      </span>
                    )}
                    {unitCount > 0 && (
                      <span className="text-dark-muted">{unitCount} уст.</span>
                    )}
                  </div>
                </div>
                {s.total > 0 ? (
                  isMethodOpen
                    ? <ChevronUp size={18} className="text-dark-muted shrink-0" />
                    : <ChevronDown size={18} className="text-dark-muted shrink-0" />
                ) : (
                  <span className="text-xs text-dark-muted shrink-0">нет</span>
                )}
              </button>

              {/* Level 2: Units list */}
              {isMethodOpen && s.total > 0 && (
                <div className="border-t border-dark-border">
                  {Object.entries(unitGroups).map(([unitCode, unitGroup]) => {
                    const isUnitOpen = expandedUnit === `${key}__${unitCode}`
                    return (
                      <div key={unitCode}>
                        <button
                          onClick={() => toggleUnit(`${key}__${unitCode}`)}
                          className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-white/5 transition-colors border-b border-dark-border/30"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            unitGroup.items.some(a => a.severity === 'critical') ? 'bg-accent-red' : 'bg-accent-yellow'
                          }`} />
                          <span className="text-sm text-dark-text flex-1">{unitGroup.name}</span>
                          <span className="text-xs text-dark-muted tabular-nums">{unitGroup.items.length} событий</span>
                          {isUnitOpen
                            ? <ChevronUp size={14} className="text-dark-muted shrink-0" />
                            : <ChevronDown size={14} className="text-dark-muted shrink-0" />
                          }
                        </button>

                        {/* Level 3: Details table */}
                        {isUnitOpen && (
                          <div className="bg-[#080e20] px-6 py-3 border-b border-dark-border/30">
                            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-[#080e20]">
                                  <tr className="border-b border-dark-border text-left text-dark-muted">
                                    <th className="px-2 py-1.5">Дата</th>
                                    <th className="px-2 py-1.5">Описание</th>
                                    <th className="px-2 py-1.5 text-right">Значение</th>
                                    <th className="px-2 py-1.5 text-right">Порог</th>
                                    <th className="px-2 py-1.5">Уровень</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {unitGroup.items.map((a, i) => (
                                    <tr key={i} className="border-b border-dark-border/20 hover:bg-white/5">
                                      <td className="px-2 py-1.5 text-dark-text whitespace-nowrap">{a.date}</td>
                                      <td className="px-2 py-1.5 text-dark-muted">{a.description}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums text-dark-text">{a.value}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums text-dark-muted">{a.threshold}</td>
                                      <td className="px-2 py-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          a.severity === 'critical' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-yellow/10 text-accent-yellow'
                                        }`}>
                                          {a.severity === 'critical' ? 'Критично' : 'Внимание'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Units grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {data.units.map(u => (
          <UnitCard
            key={u.code}
            unit={u}
            anomalies={anomalies || []}
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
