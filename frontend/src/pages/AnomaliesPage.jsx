import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import EventLog from '../components/EventLog'
import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch, Download, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useDateFilter } from '../hooks/useDateFilter'

const methodConfig = {
  balance_closure: {
    label: 'Потери и утечки',
    icon: AlertTriangle,
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    description: 'Дебаланс входа и выхода превышает допустимый порог. Разница между поступившим и выпущенным продуктом указывает на потери, утечки или ошибки учёта.',
  },
  recon_gap: {
    label: 'Прибор/Согласов.',
    icon: BarChart3,
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    description: 'Расхождение между показаниями приборов и согласованным балансом. Большой разрыв может означать дрейф приборов или ручные корректировки.',
  },
  spc: {
    label: 'SPC',
    icon: Activity,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    description: 'Статистический контроль процесса. Значения дебаланса выходят за контрольные границы ±2σ или ±3σ от среднего.',
  },
  cusum: {
    label: 'CUSUM',
    icon: TrendingUp,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    description: 'Кумулятивная сумма отклонений. Выявляет устойчивый сдвиг (тренд) в процессе, который не виден на обычном графике.',
  },
  downtime: {
    label: 'Простой',
    icon: Clock,
    color: 'text-dark-muted',
    bg: 'bg-white/5',
    description: 'Дни, когда установка не работала — входной и выходной потоки близки к нулю (<1 т).',
  },
  cross_unit: {
    label: 'Межцеховой',
    icon: GitBranch,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    description: 'Несовпадение потоков между связанными установками. Выход одной установки не совпадает с входом другой.',
  },
}

function exportCSV(anomalies) {
  if (!anomalies || anomalies.length === 0) return
  const headers = ['Дата', 'Установка', 'Метод', 'Описание', 'Значение', 'Порог', 'Уровень']
  const methodLabels = {
    balance_closure: 'Потери и утечки',
    recon_gap: 'Прибор/Согласов.',
    spc: 'SPC', cusum: 'CUSUM',
    downtime: 'Простой', cross_unit: 'Межцеховой',
  }
  const rows = anomalies.map(a => [
    a.date,
    a.unit_name || '',
    methodLabels[a.method] || a.method,
    `"${(a.description || '').replace(/"/g, '""')}"`,
    a.value,
    a.threshold,
    a.severity === 'critical' ? 'Критично' : a.severity === 'warn' ? 'Внимание' : a.severity,
  ])
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `anomalies_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function AnomaliesPage() {
  const [filterMethod, setFilterMethod] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [expandedMethod, setExpandedMethod] = useState(null)
  const { dateParams } = useDateFilter()

  const { data: summary } = useQuery({
    queryKey: ['anomalySummary', dateParams],
    queryFn: () => api.get('/anomalies/summary', { params: dateParams }).then(r => r.data),
  })

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', filterMethod, filterSeverity, filterUnit, dateParams],
    queryFn: () => {
      const params = { ...dateParams }
      if (filterMethod) params.method = filterMethod
      if (filterSeverity) params.severity = filterSeverity
      if (filterUnit) params.unit = filterUnit
      return api.get('/anomalies', { params }).then(r => r.data)
    },
  })

  // Get unique units from anomalies for filter dropdown
  const unitOptions = useMemo(() => {
    if (!anomalies) return []
    const units = new Map()
    anomalies.forEach(a => {
      if (a.unit && a.unit_name) units.set(a.unit, a.unit_name)
    })
    return [...units.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [anomalies])

  // We need unfiltered anomalies for unit list — use separate query
  const { data: allAnomalies } = useQuery({
    queryKey: ['anomaliesAll', dateParams],
    queryFn: () => api.get('/anomalies', { params: dateParams }).then(r => r.data),
  })

  const allUnitOptions = useMemo(() => {
    if (!allAnomalies) return []
    const units = new Map()
    allAnomalies.forEach(a => {
      if (a.unit && a.unit_name) units.set(a.unit, a.unit_name)
    })
    return [...units.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allAnomalies])

  // Downtime list
  const downtimeList = useMemo(() => {
    if (!allAnomalies) return []
    return allAnomalies
      .filter(a => a.method === 'downtime')
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allAnomalies])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Аномалии</h1>

      {/* Method summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(methodConfig).map(([key, cfg]) => {
          const Icon = cfg.icon
          const s = summary?.[key] || { total: 0, critical: 0, warn: 0 }
          const isActive = filterMethod === key
          const isExpanded = expandedMethod === key
          return (
            <div key={key} className="relative">
              <button
                onClick={() => setFilterMethod(isActive ? '' : key)}
                className={`w-full bg-dark-card border rounded-xl p-3 text-left transition-all ${
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
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedMethod(isExpanded ? null : key) }}
                className="absolute top-2 right-2 text-dark-muted hover:text-accent-blue"
              >
                <Info size={13} />
              </button>
              {isExpanded && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-dark-card border border-dark-border rounded-lg p-2.5 text-xs text-dark-muted shadow-lg">
                  {cfg.description}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterUnit}
          onChange={e => setFilterUnit(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text"
        >
          <option value="">Все установки</option>
          {allUnitOptions.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text"
        >
          <option value="">Все уровни</option>
          <option value="critical">Критично</option>
          <option value="warn">Внимание</option>
        </select>
        {(filterMethod || filterSeverity || filterUnit) && (
          <button
            onClick={() => { setFilterMethod(''); setFilterSeverity(''); setFilterUnit('') }}
            className="text-xs text-accent-blue hover:underline"
          >
            Сбросить фильтры
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => exportCSV(anomalies)}
          disabled={!anomalies || anomalies.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          Экспорт CSV
        </button>
      </div>

      {/* Event log */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <EventLog anomalies={anomalies || []} />
      </div>

      {/* Downtime section */}
      {downtimeList.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-dark-text mb-3 flex items-center gap-2">
            <Clock size={16} className="text-dark-muted" />
            Простои по дням ({downtimeList.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-left text-dark-muted">
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Установка</th>
                  <th className="px-3 py-2">Описание</th>
                </tr>
              </thead>
              <tbody>
                {downtimeList.map((d, i) => (
                  <tr key={i} className="border-b border-dark-border/50 hover:bg-white/5">
                    <td className="px-3 py-2 whitespace-nowrap text-dark-text">{d.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-dark-text">{d.unit_name || '—'}</td>
                    <td className="px-3 py-2 text-dark-muted">{d.description}</td>
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
