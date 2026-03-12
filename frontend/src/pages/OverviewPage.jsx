import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import KPICard from '../components/KPICard'
import UnitCard from '../components/UnitCard'
import HeatmapChart from '../components/HeatmapChart'
import AnomalyBarChart from '../components/AnomalyBarChart'
import { useDateFilter } from '../hooks/useDateFilter'
import { AlertTriangle, BarChart3, Activity, Clock, GitBranch, ChevronDown, ChevronUp, Download, Info } from 'lucide-react'
import * as XLSX from 'xlsx'

const methodConfig = {
  balance_closure: {
    label: 'Небаланс вход/выход', icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/10',
    desc: 'Разница между тем, что поступило на установку, и тем, что вышло. Если разница больше порога — возможны потери продукции, ошибки приборов или неучтённые сбросы.',
  },
  recon_gap: {
    label: 'Расхождение измерено/согласовано', icon: BarChart3, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10',
    desc: 'Приборы показали одно значение, а в согласованном балансе — другое. Чем больше разница — тем менее достоверны данные. Причины: неточные приборы, ручные корректировки, ошибки ввода.',
  },
  spc: {
    label: 'Нетипичные дни', icon: Activity, color: 'text-accent-blue', bg: 'bg-accent-blue/10',
    desc: 'Дни, когда загрузка установки резко отличалась от обычного уровня. Возможны сбои оборудования, ошибки данных или нештатные режимы работы.',
  },
  downtime: {
    label: 'Простой', icon: Clock, color: 'text-dark-muted', bg: 'bg-white/5',
    desc: 'Загрузка установки ниже порога от среднего уровня — установка не работала или работала на минимуме. Порог задаёт, при каком проценте от обычной загрузки день считается простоем.',
  },
  cross_unit: {
    label: 'Потери продукции между установками', icon: GitBranch, color: 'text-accent-green', bg: 'bg-accent-green/10',
    desc: 'Одна установка отдала продукт, а следующая получила меньше. Разница может означать потери при передаче, ошибки учёта или утечки на соединительных трубопроводах.',
  },
}

/* ---- cell border classes for all tables ---- */
const thCls = 'px-2 py-1.5 border border-dark-border/40'
const tdCls = 'px-2 py-1.5 border border-dark-border/20'

function exportOverviewExcel(anomalies, methodKey) {
  if (!anomalies || anomalies.length === 0) return
  const label = methodConfig[methodKey]?.label || methodKey
  const rows = anomalies.map(a => {
    const row = { 'Дата': a.date, 'Установка': a.unit_name || '' }
    if (a.input_measured != null) {
      row['Вход изм (т)'] = a.input_measured
      row['Вход согл (т)'] = a.input_reconciled
      row['Выход изм (т)'] = a.output_measured
      row['Выход согл (т)'] = a.output_reconciled
      row['Δ (т)'] = a.delta_tons
      row['Δ (% от изм)'] = a.delta_pct
    }
    if (a.consumed != null) {
      row['Загрузка (т)'] = a.consumed
      row['Выпуск (т)'] = a.produced
      row['Среднее (т)'] = a.mean
    }
    row['Описание'] = a.description || ''
    row['Значение'] = a.value
    row['Порог'] = a.threshold
    row['Уровень'] = a.severity === 'critical' ? 'Критично' : 'Внимание'
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
  XLSX.writeFile(wb, `${label}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportDowntimeExcel(events, unitName) {
  if (!events || events.length === 0) return
  const rows = events.map(e => ({
    'Начало': e.start_date,
    'Конец': e.end_date,
    'Дней': e.days,
    'Часов': e.days * 24,
    'Тип': e.type === 'stop' ? 'Полный простой' : 'Сниженная загрузка',
    'Факт выпуск (т/сут)': e.fact_output ?? 0,
    'Норма выпуск (т/сут)': e.norm_output ?? 0,
    'Сокращение выпуска (т)': e.lost_output_tons ?? 0,
    'Загрузка (%)': e.avg_load_pct,
    'Обоснование': e.reason,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 7 }, { wch: 22 },
    { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 70 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Простои')
  XLSX.writeFile(wb, `Простои_${unitName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function formatDuration(days) {
  const hours = days * 24
  if (days === 1) return '1 дн (24 ч)'
  return `${days} дн (${hours} ч)`
}

export default function OverviewPage() {
  const { dateParams } = useDateFilter()
  const [expandedMethod, setExpandedMethod] = useState(null)
  const [expandedUnit, setExpandedUnit] = useState(null)
  const [infoOpen, setInfoOpen] = useState(null) // which method's info panel is open

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

  const toggleInfo = (key, e) => {
    e.stopPropagation()
    setInfoOpen(prev => prev === key ? null : key)
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

      {/* Three-level accordion: Method -> Units -> Details */}
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
              <div className="flex items-center">
                <button
                  onClick={() => toggleMethod(key)}
                  className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-dark-text flex items-center gap-2">
                      {cfg.label}
                      <button
                        onClick={(e) => toggleInfo(key, e)}
                        className={`p-0.5 rounded transition-colors ${
                          infoOpen === key ? 'text-accent-blue bg-accent-blue/10' : 'text-dark-muted hover:text-dark-text'
                        }`}
                        title="Описание метода"
                      >
                        <Info size={14} />
                      </button>
                    </div>
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
                {s.total > 0 && (
                  <button
                    onClick={() => {
                      const methodAnomalies = (anomalies || []).filter(a => a.method === key)
                      exportOverviewExcel(methodAnomalies, key)
                    }}
                    className="mr-4 flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20 shrink-0"
                  >
                    <Download size={12} />
                    Excel
                  </button>
                )}
              </div>

              {/* Info panel */}
              {infoOpen === key && (
                <div className="mx-4 mb-3 px-3 py-2 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
                  <p className="text-xs text-dark-muted leading-relaxed">{cfg.desc}</p>
                </div>
              )}

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

                        {/* Level 3: Details */}
                        {isUnitOpen && key === 'downtime' && (
                          <DowntimeBlock unitCode={unitCode} unitName={unitGroup.name} dateParams={dateParams} />
                        )}
                        {isUnitOpen && key !== 'downtime' && (
                          <MethodDetailTable method={key} items={unitGroup.items} unitName={unitGroup.name} />
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

/* ================================================================
   DowntimeBlock — fetches grouped downtime events per unit
   Identical to UnitCard's DowntimeSection
   ================================================================ */
function DowntimeBlock({ unitCode, unitName, dateParams }) {
  const { data, isLoading } = useQuery({
    queryKey: ['downtimeOverview', unitCode, dateParams],
    queryFn: () => api.get('/anomalies/downtime-details', { params: { unit: unitCode, ...dateParams } }).then(r => r.data),
  })

  if (isLoading) return <div className="px-6 py-3 text-sm text-dark-muted">Загрузка простоев...</div>

  const events = data?.events || []
  if (events.length === 0) return <div className="px-6 py-3 text-sm text-dark-muted">Простоев не обнаружено</div>

  const totalLostOutput = events.reduce((s, e) => s + (e.lost_output_tons ?? 0), 0)

  return (
    <div className="bg-[#080e20] px-6 py-3 border-b border-dark-border/30">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-dark-text flex items-center gap-2">
            <Clock size={15} className="text-accent-yellow" />
            Простои и снижение загрузки ({events.length} событий)
            {totalLostOutput > 0 && (
              <span className="text-xs font-normal text-accent-red ml-2">
                Сокращение выпуска: −{totalLostOutput.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} т
              </span>
            )}
          </h4>
          <button
            onClick={() => exportDowntimeExcel(events, unitName)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
          >
            <Download size={12} />
            Excel
          </button>
        </div>

        <div className="overflow-x-auto max-h-[210px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-dark-card">
              <tr className="text-left text-dark-muted">
                <th className={thCls}>Начало</th>
                <th className={thCls}>Конец</th>
                <th className={`${thCls} text-right`}>Длительность</th>
                <th className={thCls}>Тип</th>
                <th className={`${thCls} text-right`}>Факт выпуск (т/сут)</th>
                <th className={`${thCls} text-right`}>Норма выпуск (т/сут)</th>
                <th className={`${thCls} text-right`}>Сокращение выпуска (т)</th>
                <th className={`${thCls} text-right`}>% загрузки</th>
                <th className={thCls}>Обоснование</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const lostOut = e.lost_output_tons ?? 0
                return (
                  <tr key={i} className="hover:bg-white/5">
                    <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{e.start_date}</td>
                    <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{e.end_date}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold text-dark-text whitespace-nowrap`}>{formatDuration(e.days)}</td>
                    <td className={tdCls}>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        e.type === 'stop' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-yellow/10 text-accent-yellow'
                      }`}>
                        {e.type === 'stop' ? 'Остановка' : 'Снижение'}
                      </span>
                    </td>
                    <td className={`${tdCls} text-right tabular-nums text-accent-red`}>{(e.fact_output ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</td>
                    <td className={`${tdCls} text-right tabular-nums text-dark-muted`}>{(e.norm_output ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold text-accent-red`}>
                      {lostOut > 0 ? `−${lostOut.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}` : '0'}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      <span className={e.avg_load_pct < 10 ? 'text-accent-red' : 'text-accent-yellow'}>{e.avg_load_pct}%</span>
                    </td>
                    <td className={`${tdCls} text-dark-muted max-w-xs`}>{e.reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   MethodDetailTable — non-downtime methods
   Identical columns to UnitCard's AnomalyMethodSection
   ================================================================ */
function MethodDetailTable({ method, items, unitName }) {
  const isBalanceClosure = method === 'balance_closure'
  const isReconGap = method === 'recon_gap'
  const isSpc = method === 'spc'
  const isCrossUnit = method === 'cross_unit'
  const cfg = methodConfig[method]
  const Icon = cfg?.icon

  return (
    <div className="bg-[#080e20] px-6 py-3 border-b border-dark-border/30">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-dark-text flex items-center gap-2">
            {Icon && <Icon size={15} className={cfg.color} />}
            {cfg?.label || method} ({items.length} событий)
          </h4>
          <button
            onClick={() => exportOverviewExcel(items, method)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
          >
            <Download size={12} />
            Excel
          </button>
        </div>

        <div className="overflow-x-auto max-h-[210px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-dark-card">
              <tr className="text-left text-dark-muted">
                <th className={thCls}>Дата</th>
                {isBalanceClosure && (
                  <>
                    <th className={`${thCls} text-right`}>Вход замер (т)</th>
                    <th className={`${thCls} text-right`}>Выход замер (т)</th>
                    <th className={`${thCls} text-right`}>Небаланс (т)</th>
                    <th className={`${thCls} text-right`}>Небаланс (%)</th>
                  </>
                )}
                {isReconGap && (
                  <>
                    <th className={`${thCls} text-right`}>Замер сырьё (т)</th>
                    <th className={`${thCls} text-right`}>Согласов сырьё (т)</th>
                    <th className={`${thCls} text-right`}>Δ сырьё (т)</th>
                    <th className={`${thCls} text-right`}>Δ сырьё (%)</th>
                    <th className={`${thCls} text-right`}>Замер продукц (т)</th>
                    <th className={`${thCls} text-right`}>Согласов продукц (т)</th>
                    <th className={`${thCls} text-right`}>Δ продукц (т)</th>
                    <th className={`${thCls} text-right`}>Δ продукц (%)</th>
                  </>
                )}
                {isSpc && (
                  <>
                    <th className={`${thCls} text-right`}>Загрузка (т)</th>
                    <th className={`${thCls} text-right`}>Выпуск (т)</th>
                    <th className={`${thCls} text-right`}>Среднее (т)</th>
                    <th className={`${thCls} text-right`}>Отклонение (σ)</th>
                  </>
                )}
                {isCrossUnit && (
                  <>
                    <th className={thCls}>Продукт</th>
                    <th className={thCls}>Откуда</th>
                    <th className={thCls}>Куда</th>
                    <th className={`${thCls} text-right`}>Отдано (т)</th>
                    <th className={`${thCls} text-right`}>Принято (т)</th>
                    <th className={`${thCls} text-right`}>Потери (т)</th>
                    <th className={`${thCls} text-right`}>Δ%</th>
                  </>
                )}
                {!isBalanceClosure && !isReconGap && !isSpc && !isCrossUnit && (
                  <>
                    <th className={thCls}>Описание</th>
                    <th className={`${thCls} text-right`}>Значение</th>
                    <th className={`${thCls} text-right`}>Порог</th>
                  </>
                )}
                <th className={thCls}>Уровень</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{a.date}</td>
                  {isBalanceClosure && (
                    <>
                      <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{(a.input_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{(a.output_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.delta_tons ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.delta_pct ?? 0).toFixed(2)}%</td>
                    </>
                  )}
                  {isReconGap && (
                    <>
                      <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{(a.input_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{(a.input_reconciled ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-yellow font-medium`}>{(a.delta_input_tons ?? Math.abs((a.input_measured ?? 0) - (a.input_reconciled ?? 0))).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-yellow font-medium`}>{(a.delta_input_pct ?? 0).toFixed(2)}%</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{(a.output_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{(a.output_reconciled ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-yellow font-medium`}>{(a.delta_output_tons ?? Math.abs((a.output_measured ?? 0) - (a.output_reconciled ?? 0))).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-yellow font-medium`}>{(a.delta_output_pct ?? 0).toFixed(2)}%</td>
                    </>
                  )}
                  {isSpc && (
                    <>
                      <td className={`${tdCls} text-right tabular-nums text-dark-text`}>{(a.consumed ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-dark-text`}>{(a.produced ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-dark-muted`}>{(a.mean ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.value ?? 0).toFixed(2)}σ</td>
                    </>
                  )}
                  {isCrossUnit && (
                    <>
                      <td className={`${tdCls} text-dark-text`}>{a.product}</td>
                      <td className={`${tdCls} text-dark-text`}>{a.source_unit_name || '—'}</td>
                      <td className={`${tdCls} text-dark-text`}>{a.target_unit_name || '—'}</td>
                      <td className={`${tdCls} text-right tabular-nums text-dark-muted`}>{(a.output_value ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-dark-muted`}>{(a.input_value ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{((a.output_value ?? 0) - (a.input_value ?? 0)).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                      <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.value ?? 0).toFixed(1)}%</td>
                    </>
                  )}
                  {!isBalanceClosure && !isReconGap && !isSpc && !isCrossUnit && (
                    <>
                      <td className={`${tdCls} text-dark-muted`}>{a.description}</td>
                      <td className={`${tdCls} text-right tabular-nums text-dark-text`}>{a.value}</td>
                      <td className={`${tdCls} text-right tabular-nums text-dark-muted`}>{a.threshold}</td>
                    </>
                  )}
                  <td className={tdCls}>
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
    </div>
  )
}
