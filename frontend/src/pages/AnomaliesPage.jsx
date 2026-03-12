import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import EventLog from '../components/EventLog'
import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch, Download, Info } from 'lucide-react'
import { useDateFilter } from '../hooks/useDateFilter'
import * as XLSX from 'xlsx'

const methodConfig = {
  balance_closure: {
    label: 'Небаланс вход/выход',
    icon: AlertTriangle,
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    description: 'Разница между тем, что поступило на установку, и тем, что вышло. Если разница больше порога — возможны потери продукции, ошибки приборов или неучтённые сбросы.',
    risk: 'Неучтённые потери продукции, финансовые убытки.',
    check: 'Акты инвентаризации, журнал нештатных ситуаций, показания приборов на входе и выходе.',
  },
  recon_gap: {
    label: 'Расхождение измерено/согласовано',
    icon: BarChart3,
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    description: 'Приборы показали одно значение, а в согласованном балансе стоит другое. Чем больше разница — тем менее достоверны данные.',
    risk: 'Недостоверные данные учёта, невозможность контролировать реальные объёмы.',
    check: 'Акты проверки приборов, журнал ручных корректировок, протоколы согласования баланса.',
  },
  spc: {
    label: 'Нетипичные дни',
    icon: Activity,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    description: 'Дни, когда загрузка установки резко отличалась от обычного уровня. Возможны сбои оборудования, ошибки данных или нештатные режимы.',
    risk: 'Скрытые проблемы оборудования, нештатные режимы, ошибки ввода данных.',
    check: 'Журнал работы установки за эти дни, заявки на ремонт, данные о переключениях режимов.',
  },
  cusum: {
    label: 'Скрытый тренд',
    icon: TrendingUp,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    description: 'Показатели понемногу смещаются в одну сторону день за днём. По отдельности каждый день нормальный, но в сумме видно отклонение от нормы.',
    risk: 'Постепенный износ оборудования, изменение качества сырья, систематическая ошибка учёта.',
    check: 'Графики обслуживания оборудования, паспорта качества сырья, изменения в технологических картах.',
  },
  downtime: {
    label: 'Простой',
    icon: Clock,
    color: 'text-dark-muted',
    bg: 'bg-white/5',
    description: 'Установка не работала или работала на минимуме. Загрузка значительно ниже обычного уровня.',
    risk: 'Потеря выработки, срыв плана, простой связанных установок.',
    check: 'Акты остановки/пуска, заявки на ремонт, графики ТО, причины ограничения загрузки.',
  },
  cross_unit: {
    label: 'Потери продукции между установками',
    icon: GitBranch,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    description: 'Одна установка отдала продукт, а следующая получила меньше. Разница может означать потери при передаче или ошибки учёта.',
    risk: 'Потери продукции на соединительных трубопроводах, ошибки учёта на стыках.',
    check: 'Показания приборов на границах установок, акты передачи продукции, состояние трубопроводов.',
  },
}

const methodLabels = {
  balance_closure: 'Небаланс вход/выход',
  recon_gap: 'Расхождение измерено/согласовано',
  spc: 'Нетипичные дни',
  cusum: 'Скрытый тренд',
  downtime: 'Простой',
  cross_unit: 'Потери продукции между установками',
}

function exportExcel(anomalies) {
  if (!anomalies || anomalies.length === 0) return
  const rows = anomalies.map(a => ({
    'Дата': a.date,
    'Установка': a.unit_name || '',
    'Тип аномалии': methodLabels[a.method] || a.method,
    'Описание': a.description || '',
    'Значение': a.value,
    'Порог': a.threshold,
    'Уровень': a.severity === 'critical' ? 'Критично' : a.severity === 'warn' ? 'Внимание' : a.severity,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  // Ширина колонок
  ws['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 60 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Аномалии')
  XLSX.writeFile(wb, `Аномалии_${new Date().toISOString().slice(0, 10)}.xlsx`)
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

  // Unfiltered anomalies for unit dropdown
  const { data: allAnomalies } = useQuery({
    queryKey: ['anomaliesAll', dateParams],
    queryFn: () => api.get('/anomalies', { params: dateParams }).then(r => r.data),
  })

  // Downtime details
  const { data: downtimeData } = useQuery({
    queryKey: ['downtimeDetails', dateParams],
    queryFn: () => api.get('/anomalies/downtime-details', { params: dateParams }).then(r => r.data),
  })

  const allUnitOptions = useMemo(() => {
    if (!allAnomalies) return []
    const units = new Map()
    allAnomalies.forEach(a => {
      if (a.unit && a.unit_name) units.set(a.unit, a.unit_name)
    })
    return [...units.entries()].sort((a, b) => a[1].localeCompare(b[1]))
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
          onClick={() => exportExcel(anomalies)}
          disabled={!anomalies || anomalies.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          Выгрузить в Excel
        </button>
      </div>

      {/* Event log */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <EventLog anomalies={anomalies || []} />
      </div>

      {/* Downtime card */}
      {downtimeData && (downtimeData.events?.length > 0 || downtimeData.unit_stats?.length > 0) && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-dark-text flex items-center gap-2">
            <Clock size={16} className="text-accent-yellow" />
            Анализ простоев и снижения загрузки
          </h2>

          {/* Unit stats summary */}
          {downtimeData.unit_stats?.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-dark-muted mb-2">Сводка по установкам</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-border text-left text-dark-muted text-xs">
                      <th className="px-3 py-2">Установка</th>
                      <th className="px-3 py-2 text-right">Полных простоев</th>
                      <th className="px-3 py-2 text-right">Сниженная загрузка</th>
                      <th className="px-3 py-2 text-right">Обычная загрузка (т/день)</th>
                      <th className="px-3 py-2 text-right">Обычный выпуск (т/день)</th>
                      <th className="px-3 py-2 text-right">Недополучено сырья (т)</th>
                      <th className="px-3 py-2 text-right">Недовыпущено продукции (т)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeData.unit_stats.map((s, i) => (
                      <tr key={i} className="border-b border-dark-border/50 hover:bg-white/5">
                        <td className="px-3 py-2 text-dark-text font-medium">{s.unit_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-accent-red font-semibold">{s.stop_days} дн.</td>
                        <td className="px-3 py-2 text-right tabular-nums text-accent-yellow">{s.low_load_days} дн.</td>
                        <td className="px-3 py-2 text-right tabular-nums text-dark-muted">{s.avg_consumed.toLocaleString('ru-RU')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-dark-muted">{s.avg_produced.toLocaleString('ru-RU')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-accent-red">{s.total_lost_input.toLocaleString('ru-RU')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-accent-red">{s.total_lost_output.toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily events */}
          {downtimeData.events?.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-dark-muted mb-2">Журнал событий по дням ({downtimeData.events.length})</h3>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-dark-card">
                    <tr className="border-b border-dark-border text-left text-dark-muted text-xs">
                      <th className="px-3 py-2">Дата</th>
                      <th className="px-3 py-2">Установка</th>
                      <th className="px-3 py-2">Тип</th>
                      <th className="px-3 py-2 text-right">Загрузка (т)</th>
                      <th className="px-3 py-2 text-right">Выпуск (т)</th>
                      <th className="px-3 py-2 text-right">% от нормы</th>
                      <th className="px-3 py-2 text-right">Потери сырья (т)</th>
                      <th className="px-3 py-2 text-right">Потери продукции (т)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeData.events.map((e, i) => (
                      <tr key={i} className="border-b border-dark-border/50 hover:bg-white/5">
                        <td className="px-3 py-2 whitespace-nowrap text-dark-text">{e.date}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-dark-text">{e.unit_name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            e.type === 'stop'
                              ? 'bg-accent-red/10 text-accent-red'
                              : 'bg-accent-yellow/10 text-accent-yellow'
                          }`}>
                            {e.type === 'stop' ? 'Полный простой' : 'Сниженная загрузка'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-dark-muted">{e.consumed}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-dark-muted">{e.produced}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={e.load_pct < 10 ? 'text-accent-red' : 'text-accent-yellow'}>
                            {e.load_pct}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-accent-red">{e.lost_input_tons}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-accent-red">{e.lost_output_tons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-3 bg-dark-bg/50 border border-dark-border rounded-lg text-xs text-dark-muted space-y-1.5">
            <p className="font-semibold text-accent-blue">Рекомендации</p>
            <p>Запросите у технологической службы причины простоев и снижения загрузки за указанные даты:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Акты остановки/пуска оборудования</li>
              <li>Заявки на ремонт и графики ТО</li>
              <li>Журнал технологических нарушений</li>
              <li>Сведения о качестве поступившего сырья</li>
              <li>Ограничения по приёму/отгрузке продукции</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
