import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import KPICard from '../components/KPICard'
import UnitCard from '../components/UnitCard'
import HeatmapChart from '../components/HeatmapChart'
import AnomalyBarChart from '../components/AnomalyBarChart'
import { useDateFilter } from '../hooks/useDateFilter'
import { AlertTriangle, BarChart3, Activity, Clock, GitBranch, ChevronDown, ChevronUp, Download, Info } from 'lucide-react'
import * as XLSX from 'xlsx'
import ExportDialog from '../components/ExportDialog'
import { downloadXlsx, fmtDate } from '../utils/excelExport'
import InfoTooltip from '../components/InfoTooltip'
import PlanFactBlock from '../components/PlanFactBlock'
import CorrectionsBlock from '../components/CorrectionsBlock'

const methodConfig = {
  balance_closure: {
    label: 'Небаланс вход/выход', icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/10', hex: '#f87171',
    desc: 'Разница между входом и выходом установки. Внимание — превышение порога, Критично — превышение порога ×2. Причины: потери продукции, ошибки приборов, неучтённые сбросы.',
  },
  recon_gap: {
    label: 'Расхождение измерено/согласовано', icon: BarChart3, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', hex: '#f59e0b',
    desc: 'Разница между показаниями приборов и согласованным балансом. Внимание — превышение порога, Критично — превышение порога ×2. Причины: неточные приборы, ручные корректировки, ошибки ввода.',
  },
  spc: {
    label: 'Нетипичные дни', icon: Activity, color: 'text-accent-blue', bg: 'bg-accent-blue/10', hex: '#3b82f6',
    desc: 'Дни с резким отклонением загрузки от среднего. Внимание — превышение порога σ, Критично — превышение порога ×2 σ. Причины: сбои оборудования, ошибки данных, нештатные режимы.',
  },
  downtime: {
    label: 'Простой', icon: Clock, color: 'text-dark-muted', bg: 'bg-white/5', hex: '#64748b',
    desc: 'Загрузка ниже порога от среднего. Внимание — ниже порога, Критично — ниже порога/2. Полный простой (<1 т) всегда Критично.',
  },
  cross_unit: {
    label: 'Потери продукции между установками', icon: GitBranch, color: 'text-accent-green', bg: 'bg-accent-green/10', hex: '#22d3ee',
    desc: 'Потери при передаче продукта между установками. Внимание — превышение порога, Критично — превышение порога ×2. Причины: потери в трубопроводах, ошибки учёта.',
  },
}

/* ---- cell border classes for all tables ---- */
const thCls = 'px-3 py-2 border border-slate-600 bg-slate-800/50'
const tdCls = 'px-3 py-2 border border-slate-600/70'

/* ---- Sortable table helpers ---- */
function useSortTable() {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const toggle = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  return { sortCol, sortDir, toggle }
}

function sortData(items, col, dir, getVal) {
  if (!col || !items) return items
  const getter = getVal || ((item, c) => item[c])
  return [...items].sort((a, b) => {
    let va = getter(a, col) ?? '', vb = getter(b, col) ?? ''
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ru')
    return dir === 'asc' ? cmp : -cmp
  })
}

function SortTh({ children, col, sortCol, sortDir, onSort, className = '' }) {
  const active = sortCol === col
  return (
    <th className={`${className} cursor-pointer select-none hover:text-dark-text whitespace-nowrap`} onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        <span className="text-[9px] opacity-60">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}

async function exportOverviewExcel(anomalies, methodKey) {
  if (!anomalies || anomalies.length === 0) return
  const label = methodConfig[methodKey]?.label || methodKey
  const sev = a => a.severity === 'critical' ? 'Критично' : 'Внимание'
  const isBalance = methodKey === 'balance_closure'
  const isRecon = methodKey === 'recon_gap'
  const isSpc = methodKey === 'spc'
  const canExpand = isBalance || isRecon || isSpc

  // Fetch product details for expandable methods
  let productCache = {}
  if (canExpand) {
    const keys = new Set()
    anomalies.forEach(a => keys.add(`${a.unit}__${a.date}`))
    for (const key of keys) {
      const [unit, date] = key.split('__')
      try {
        const resp = await api.get('/anomalies/product-details', { params: { unit, date } })
        productCache[key] = resp.data
      } catch { productCache[key] = { inputs: [], outputs: [] } }
    }
  }

  const rows = []
  const rowOutlines = []

  for (const a of anomalies) {
    const u = a.unit_name || ''
    let row
    if (isBalance) {
      row = {
        'Дата': fmtDate(a.date), 'Установка': u,
        'Вход сырья изм (т)': a.input_measured, 'Вход сырья согл (т)': a.input_reconciled,
        'Выход продукции изм (т)': a.output_measured, 'Выход продукции согл (т)': a.output_reconciled,
        'Небаланс (т)': a.delta_tons, 'Небаланс (%)': a.delta_pct, 'Уровень': sev(a),
      }
    } else if (isRecon) {
      row = {
        'Дата': fmtDate(a.date), 'Установка': u, 'Сырьё изм (т)': a.input_measured, 'Сырьё согл (т)': a.input_reconciled,
        'Δ сырьё (т)': a.delta_input_tons, 'Δ сырьё (%)': a.delta_input_pct,
        'Продукция изм (т)': a.output_measured, 'Продукция согл (т)': a.output_reconciled,
        'Δ продукц (т)': a.delta_output_tons, 'Δ продукц (%)': a.delta_output_pct, 'Уровень': sev(a),
      }
    } else if (isSpc) {
      row = {
        'Дата': fmtDate(a.date), 'Установка': u, 'Загрузка (т)': a.consumed, 'Выпуск (т)': a.produced,
        'Среднее (т)': a.mean, 'Отклонение (σ)': a.value, 'Уровень': sev(a),
      }
    } else if (methodKey === 'cross_unit') {
      row = {
        'Дата': fmtDate(a.date), 'Продукт': a.product, 'Откуда': a.source_unit_name, 'Куда': a.target_unit_name,
        'Отдано (т)': a.output_value, 'Принято (т)': a.input_value,
        'Потери (т)': Math.round(((a.output_value ?? 0) - (a.input_value ?? 0)) * 10) / 10,
        'Δ%': a.value, 'Уровень': sev(a),
      }
    } else {
      row = { 'Дата': fmtDate(a.date), 'Установка': u, 'Описание': a.description, 'Значение': a.value, 'Порог': a.threshold, 'Уровень': sev(a) }
    }
    rows.push(row)
    rowOutlines.push(0)

    // Product detail rows
    if (canExpand) {
      const key = `${a.unit}__${a.date}`
      const details = productCache[key]
      if (details) {
        const addProducts = (items, direction) => {
          items.forEach(p => {
            let pRow
            if (isBalance) {
              pRow = {
                'Дата': '', 'Установка': `  ${direction}: ${p.product}`,
                'Вход сырья изм (т)': direction === 'Сырьё' ? p.measured : null,
                'Вход сырья согл (т)': direction === 'Сырьё' ? p.reconciled : null,
                'Выход продукции изм (т)': direction === 'Продукция' ? p.measured : null,
                'Выход продукции согл (т)': direction === 'Продукция' ? p.reconciled : null,
                'Небаланс (т)': p.delta_tons, 'Небаланс (%)': p.delta_pct, 'Уровень': '',
              }
            } else if (isRecon) {
              pRow = {
                'Дата': '', 'Установка': `  ${direction}: ${p.product}`,
                'Сырьё изм (т)': direction === 'Сырьё' ? p.measured : null,
                'Сырьё согл (т)': direction === 'Сырьё' ? p.reconciled : null,
                'Δ сырьё (т)': direction === 'Сырьё' ? p.delta_tons : null,
                'Δ сырьё (%)': direction === 'Сырьё' ? p.delta_pct : null,
                'Продукция изм (т)': direction === 'Продукция' ? p.measured : null,
                'Продукция согл (т)': direction === 'Продукция' ? p.reconciled : null,
                'Δ продукц (т)': direction === 'Продукция' ? p.delta_tons : null,
                'Δ продукц (%)': direction === 'Продукция' ? p.delta_pct : null,
                'Уровень': '',
              }
            } else if (isSpc) {
              pRow = {
                'Дата': '', 'Установка': `  ${direction}: ${p.product}`,
                'Загрузка (т)': direction === 'Сырьё' ? p.measured : null,
                'Выпуск (т)': direction === 'Продукция' ? p.measured : null,
                'Среднее (т)': null, 'Отклонение (σ)': null, 'Уровень': '',
              }
            }
            if (pRow) {
              rows.push(pRow)
              rowOutlines.push(1)
            }
          })
        }
        if (details.inputs?.length > 0) addProducts(details.inputs, 'Сырьё')
        if (details.outputs?.length > 0) addProducts(details.outputs, 'Продукция')
      }
    }
  }

  if (rows.length === 0) return

  const ws = XLSX.utils.json_to_sheet(rows)

  // Apply outline levels
  if (canExpand) {
    ws['!rows'] = [{}] // header
    for (let i = 0; i < rowOutlines.length; i++) {
      ws['!rows'].push({
        level: rowOutlines[i],
        hidden: rowOutlines[i] > 0,
      })
    }
    ws['!outline'] = { above: true }
  }

  const wb = XLSX.utils.book_new()
  const safe = label.replace(/[\\/?*[\]]/g, '_')
  XLSX.utils.book_append_sheet(wb, ws, safe.slice(0, 31))
  downloadXlsx(wb, `${safe}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportDowntimeExcel(events, unitName) {
  if (!events || events.length === 0) return
  const rows = events.map(e => ({
    'Начало': fmtDate(e.start_date),
    'Конец': fmtDate(e.end_date),
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
  downloadXlsx(wb, `Простои_${unitName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function formatDuration(days) {
  const hours = days * 24
  if (days === 1) return '1 дн (24 ч)'
  return `${days} дн (${hours} ч)`
}

export default function OverviewPage() {
  const { dateParams } = useDateFilter()
  const [expandedMethods, setExpandedMethods] = useState(new Set())
  const [expandedUnits, setExpandedUnits] = useState(new Set())
  const [infoOpen, setInfoOpen] = useState(null) // which method's info panel is open
  const [exportDialog, setExportDialog] = useState({ open: false, method: null })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['overview', dateParams],
    queryFn: () => api.get('/analytics/overview', { params: dateParams }).then(r => r.data),
    placeholderData: (prev) => prev,
  })

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', dateParams],
    queryFn: () => api.get('/anomalies', { params: dateParams }).then(r => r.data),
    placeholderData: (prev) => prev,
  })

  const { data: summary } = useQuery({
    queryKey: ['anomalySummary', dateParams],
    queryFn: () => api.get('/anomalies/summary', { params: dateParams }).then(r => r.data),
    placeholderData: (prev) => prev,
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

  if (isLoading && !data) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Нет данных. Загрузите файл .xlsm</div>

  const toggleMethod = (key) => {
    setExpandedMethods(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleUnit = (unitCode) => {
    setExpandedUnits(prev => {
      const next = new Set(prev)
      if (next.has(unitCode)) next.delete(unitCode)
      else next.add(unitCode)
      return next
    })
  }

  const toggleInfo = (key, e) => {
    e.stopPropagation()
    setInfoOpen(prev => prev === key ? null : key)
  }

  return (
    <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Суммарный вход (согл)" value={data.total_in} unit="т" color="blue" />
        <KPICard label="Суммарный выход (согл)" value={data.total_out} unit="т" color="green" />
        <KPICard label={<>Среднее отклонение<InfoTooltip text="Среднее (вход − выход) / вход × 100% по всем установкам." /></>} value={data.imbalance} unit="%" color={data.imbalance > 3 ? 'red' : 'yellow'} />
        <KPICard label="Всего аномалий" value={data.anomaly_count} color={data.anomaly_count > 0 ? 'red' : 'green'} />
        <KPICard label="Простои (уст-дни)" value={data.downtime_count} color={data.downtime_count > 0 ? 'yellow' : 'green'} />
      </div>

      {/* Three-level accordion: Method -> Units -> Details */}
      <div className="space-y-3">
        {Object.entries(methodConfig).map(([key, cfg]) => {
          const Icon = cfg.icon
          const s = summary?.[key] || { total: 0, critical: 0, warn: 0 }
          const isMethodOpen = expandedMethods.has(key)
          const unitGroups = anomalyTree[key] || {}
          const unitCount = Object.keys(unitGroups).length

          return (
            <div key={key} className="bg-dark-card border rounded-xl overflow-hidden" style={{
              borderColor: `${cfg.hex}60`,
              boxShadow: `0 0 10px ${cfg.hex}30, 0 0 25px ${cfg.hex}15, inset 0 0 8px ${cfg.hex}08`,
            }}>
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
                    <div className="text-lg font-bold text-dark-text flex items-center gap-2">
                      {cfg.label}
                      <button
                        onClick={(e) => toggleInfo(key, e)}
                        className={`p-0.5 rounded transition-colors ${
                          infoOpen === key ? 'text-accent-blue bg-accent-blue/10' : 'text-dark-muted hover:text-dark-text'
                        }`}
                        title="Описание метода"
                      >
                        <Info size={16} />
                      </button>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-sm">
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
                    onClick={() => setExportDialog({ open: true, method: key })}
                    className="mr-4 flex items-center gap-1 px-2 py-1 text-sm bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20 shrink-0"
                  >
                    <Download size={12} />
                    Excel
                  </button>
                )}
              </div>

              {/* Info panel */}
              {infoOpen === key && (
                <div className="mx-4 mb-3 px-3 py-2 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
                  <p className="text-sm text-slate-300 leading-relaxed">{cfg.desc}</p>
                </div>
              )}

              {/* Level 2: Units list */}
              {isMethodOpen && s.total > 0 && (
                <div className="border-t border-dark-border">
                  {Object.entries(unitGroups).map(([unitCode, unitGroup]) => {
                    const isUnitOpen = expandedUnits.has(`${key}__${unitCode}`)
                    return (
                      <div key={unitCode}>
                        <button
                          onClick={() => toggleUnit(`${key}__${unitCode}`)}
                          className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-white/5 transition-colors border-b border-dark-border/30"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            unitGroup.items.some(a => a.severity === 'critical') ? 'bg-accent-red' : 'bg-accent-yellow'
                          }`} />
                          <span className="text-base text-dark-text flex-1">{unitGroup.name}</span>
                          <span className="text-sm text-dark-muted tabular-nums">{unitGroup.items.length} событий</span>
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
                          <MethodDetailTable method={key} items={unitGroup.items} unitName={unitGroup.name} unitCode={unitCode} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {/* Corrections block (same style as method cards) */}
        <CorrectionsBlock />
      </div>

      {/* Plan/Fact blocks */}
      <PlanFactBlock mode="input" />
      <PlanFactBlock mode="output" />

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

      {/* Anomaly analytics (collapsible) */}
      <details className="bg-dark-card border border-dark-border rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-dark-text font-bold hover:bg-white/5 transition-colors">Аномалии по методам (график)</summary>
        <div className="p-5 pt-0"><AnomalyBarChart anomalies={anomalies || []} /></div>
      </details>

      {/* Heatmap (collapsible) */}
      <details className="bg-dark-card border border-dark-border rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-dark-text font-bold hover:bg-white/5 transition-colors">Тепловая карта загрузки</summary>
        <div className="p-5 pt-0"><HeatmapChart /></div>
      </details>

      {/* Export dialog */}
      {exportDialog.method && (
        <ExportDialog
          isOpen={exportDialog.open}
          onClose={() => setExportDialog({ open: false, method: null })}
          method={exportDialog.method}
          methodLabel={methodConfig[exportDialog.method]?.label || exportDialog.method}
          methodColor={methodConfig[exportDialog.method]?.hex || '#3b82f6'}
          anomalies={(anomalies || []).filter(a => a.method === exportDialog.method)}
        />
      )}
    </div>
  )
}

/* ================================================================
   DowntimeBlock — fetches grouped downtime events per unit
   Identical to UnitCard's DowntimeSection
   ================================================================ */
function DowntimeBlock({ unitCode, unitName, dateParams }) {
  const { sortCol, sortDir, toggle } = useSortTable()
  const { data, isLoading } = useQuery({
    queryKey: ['downtimeOverview', unitCode, dateParams],
    queryFn: () => api.get('/anomalies/downtime-details', { params: { unit: unitCode, ...dateParams } }).then(r => r.data),
  })

  if (isLoading) return <div className="px-6 py-3 text-sm text-dark-muted">Загрузка простоев...</div>

  const events = data?.events || []
  if (events.length === 0) return <div className="px-6 py-3 text-sm text-dark-muted">Простоев не обнаружено</div>

  const totalLostOutput = events.reduce((s, e) => s + (e.lost_output_tons ?? 0), 0)
  const sorted = sortData(events, sortCol, sortDir)
  const sp = { sortCol, sortDir, onSort: toggle }

  return (
    <div className="bg-[#080e20] px-6 py-3 border-b border-dark-border/30">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-dark-text flex items-center gap-2">
            <Clock size={18} className="text-accent-yellow" />
            Простои и снижение загрузки ({events.length} событий)
            {totalLostOutput > 0 && (
              <span className="text-sm font-normal text-accent-red ml-2">
                Сокращение выпуска: −{totalLostOutput.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} т
              </span>
            )}
          </h4>
          <button
            onClick={() => exportDowntimeExcel(events, unitName)}
            className="flex items-center gap-1 px-2 py-1 text-sm bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
          >
            <Download size={12} />
            Excel
          </button>
        </div>

        <div className="overflow-x-auto overflow-y-auto border border-slate-600 rounded-lg">
          <table className="w-full text-sm min-w-max">
            <thead className="sticky top-0 bg-dark-card z-10">
              <tr className="text-left text-slate-300">
                <SortTh col="start_date" {...sp} className={thCls}>Начало</SortTh>
                <SortTh col="end_date" {...sp} className={thCls}>Конец</SortTh>
                <SortTh col="days" {...sp} className={`${thCls} text-right`}>Длительность</SortTh>
                <SortTh col="type" {...sp} className={thCls}>Тип</SortTh>
                <SortTh col="fact_output" {...sp} className={`${thCls} text-right`}>Факт выпуск (т/сут)</SortTh>
                <SortTh col="norm_output" {...sp} className={`${thCls} text-right`}>Норма выпуск (т/сут)</SortTh>
                <SortTh col="lost_output_tons" {...sp} className={`${thCls} text-right`}>Сокращение выпуска (т)</SortTh>
                <SortTh col="avg_load_pct" {...sp} className={`${thCls} text-right`}>% загрузки</SortTh>
                <SortTh col="reason" {...sp} className={thCls}>Обоснование</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const lostOut = e.lost_output_tons ?? 0
                return (
                  <tr key={i} className="hover:bg-white/5">
                    <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{fmtDate(e.start_date)}</td>
                    <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{fmtDate(e.end_date)}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold text-dark-text whitespace-nowrap`}>{formatDuration(e.days)}</td>
                    <td className={tdCls}>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        e.type === 'stop' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-yellow/10 text-accent-yellow'
                      }`}>
                        {e.type === 'stop' ? 'Остановка' : 'Снижение'}
                      </span>
                    </td>
                    <td className={`${tdCls} text-right tabular-nums text-accent-red`}>{(e.fact_output ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</td>
                    <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(e.norm_output ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold text-accent-red`}>
                      {lostOut > 0 ? `−${lostOut.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}` : '0'}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      <span className={e.avg_load_pct < 10 ? 'text-accent-red' : 'text-accent-yellow'}>{e.avg_load_pct}%</span>
                    </td>
                    <td className={`${tdCls} text-slate-300 max-w-xs`}>{e.reason}</td>
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
function exportProductsExcel(products, unitName, dateStr) {
  const rows = []
  ;['inputs', 'outputs'].forEach(dir => {
    const label = dir === 'inputs' ? 'Сырьё' : 'Продукция'
    ;(products[dir] || []).forEach(p => {
      rows.push({ 'Дата': fmtDate(dateStr), 'Тип': label, 'Продукт': p.product, 'Замер (т)': p.measured, 'Согласов (т)': p.reconciled, 'Δ (т)': p.delta_tons, 'Δ (%)': p.delta_pct })
    })
  })
  if (rows.length === 0) return
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Продукты')
  downloadXlsx(wb, `Расхождение_продукты_${unitName}_${dateStr}.xlsx`)
}

function ProductsSubRow({ unitCode, dateStr, unitName, colSpan, method }) {
  const { data, isLoading } = useQuery({
    queryKey: ['productDetails', unitCode, dateStr],
    queryFn: () => api.get('/anomalies/product-details', { params: { unit: unitCode, date: dateStr } }).then(r => r.data),
  })

  if (isLoading) return (
    <tr><td colSpan={colSpan} className="px-4 py-2 text-xs text-dark-muted">Загрузка продуктов...</td></tr>
  )

  const inputs = data?.inputs || []
  const outputs = data?.outputs || []
  if (inputs.length === 0 && outputs.length === 0) return (
    <tr><td colSpan={colSpan} className="px-4 py-2 text-xs text-dark-muted">Нет данных по продуктам</td></tr>
  )

  const isBalance = method === 'balance_closure'
  const isRecon = method === 'recon_gap'
  const isSpc = method === 'spc'

  // Deep analysis mode for balance_closure
  if (isBalance) {
    return <DeepAnalysisSubRow data={data} inputs={inputs} outputs={outputs} colSpan={colSpan} unitName={unitName} dateStr={dateStr} />
  }

  const renderSection = (items, label, color, isInput) => items.length > 0 && (
    <>
      <tr>
        <td colSpan={colSpan} className="px-4 pt-2 pb-1">
          <span className={`text-xs font-semibold ${color}`}>{label} ({items.length} поз.)</span>
        </td>
      </tr>
      {items.map((p, j) => {
        const absPct = Math.abs(p.delta_pct ?? 0)
        const dColor = absPct > 5 ? 'text-accent-red font-medium' : absPct > 2 ? 'text-accent-yellow' : 'text-dark-muted'
        const fmt = v => (v ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})
        const fmtD = v => { const n = v ?? 0; return (n >= 0 ? '+' : '') + n.toLocaleString('ru-RU', {maximumFractionDigits:1}) }
        const fmtDp = v => { const n = v ?? 0; return (n >= 0 ? '+' : '') + n.toFixed(2) + '%' }
        return (
          <tr key={`${label}-${j}`} className="bg-[#0a1225]">
            <td className={`${tdCls} text-slate-200 pl-6`} title={p.product}>↳ {p.product}</td>
            {isRecon && (
              <>
                {isInput ? (
                  <>
                    <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{fmt(p.measured)}</td>
                    <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{fmt(p.reconciled)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${dColor}`}>{fmtD(p.delta_tons)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${dColor}`}>{fmtDp(p.delta_pct)}</td>
                    <td colSpan={4} className={tdCls} />
                  </>
                ) : (
                  <>
                    <td colSpan={4} className={tdCls} />
                    <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{fmt(p.measured)}</td>
                    <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{fmt(p.reconciled)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${dColor}`}>{fmtD(p.delta_tons)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${dColor}`}>{fmtDp(p.delta_pct)}</td>
                  </>
                )}
              </>
            )}
            {isSpc && (
              <>
                <td className={`${tdCls} text-right tabular-nums text-slate-200`}>{isInput ? fmt(p.measured) : ''}</td>
                <td className={`${tdCls} text-right tabular-nums text-slate-200`}>{!isInput ? fmt(p.measured) : ''}</td>
                <td className={tdCls} />
                <td className={tdCls} />
              </>
            )}
          </tr>
        )
      })}
    </>
  )

  return (
    <>
      <tr>
        <td colSpan={colSpan} className="bg-[#0a1225] px-4 py-1 border-t border-accent-blue/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-accent-blue font-semibold">Продукты за {fmtDate(dateStr)}</span>
            <button
              onClick={() => exportProductsExcel(data, unitName, dateStr)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-accent-blue/10 text-accent-blue rounded hover:bg-accent-blue/20"
            >
              <Download size={12} /> Excel
            </button>
          </div>
        </td>
      </tr>
      {renderSection(inputs, 'Сырьё', 'text-accent-blue', true)}
      {renderSection(outputs, 'Продукция', 'text-accent-green', false)}
      <tr><td colSpan={colSpan} className="bg-[#0a1225] h-1 border-b border-accent-blue/20" /></tr>
    </>
  )
}

/* ================================================================
   DeepAnalysisSubRow — full correction analysis for balance_closure
   Shows which products were corrected (measured vs reconciled)
   ================================================================ */
function DeepAnalysisSubRow({ data, inputs, outputs, colSpan, unitName, dateStr }) {
  const fmt = v => (v ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  const fmtPct = v => (v ?? 0).toFixed(2)
  const fmtDelta = v => { const n = v ?? 0; return (n >= 0 ? '+' : '') + n.toLocaleString('ru-RU', {maximumFractionDigits:1}) }
  const fmtDeltaPct = v => { const n = v ?? 0; return (n >= 0 ? '+' : '') + n.toFixed(2) + '%' }

  const allProducts = [
    ...inputs.map(p => ({ ...p, direction: 'Сырьё' })),
    ...outputs.map(p => ({ ...p, direction: 'Продукция' })),
  ]
  const corrected = allProducts.filter(p => Math.abs(p.delta_pct ?? 0) > 0.01).sort((a, b) => Math.abs(b.delta_pct ?? 0) - Math.abs(a.delta_pct ?? 0))
  const maxDelta = corrected.length > 0 ? Math.abs(corrected[0].delta_pct) : 0

  const totalCorrInput = inputs.reduce((s, p) => s + Math.abs(p.delta_tons ?? 0), 0)
  const totalCorrOutput = outputs.reduce((s, p) => s + Math.abs(p.delta_tons ?? 0), 0)
  const totalCorr = totalCorrInput + totalCorrOutput
  const bigCorrections = corrected.filter(p => Math.abs(p.delta_pct ?? 0) > 3)

  // Export deep analysis to Excel
  const exportAnalysis = () => {
    const rows = corrected.map(p => ({
      'Дата': fmtDate(dateStr),
      'Направление': p.direction,
      'Продукт': p.product,
      'Замер (т)': p.measured,
      'Согласов (т)': p.reconciled,
      'Корректировка (т)': p.delta_tons,
      'Корректировка (%)': p.delta_pct,
    }))
    if (rows.length === 0) return
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Анализ корректировок')
    downloadXlsx(wb, `Анализ_корректировок_${unitName}_${dateStr}.xlsx`)
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-[#060d1f] border-t border-b border-accent-red/20 px-5 py-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-accent-red" />
              <span className="text-sm font-bold text-dark-text">Анализ корректировок за {fmtDate(dateStr)}</span>
            </div>
            <button
              onClick={exportAnalysis}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded hover:bg-accent-blue/20"
            >
              <Download size={12} /> Excel
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-dark-card border border-dark-border rounded-lg px-3 py-2">
              <div className="text-[10px] text-dark-muted uppercase tracking-wider">Сумма корректировок</div>
              <div className="text-lg font-bold text-accent-yellow tabular-nums">{fmt(totalCorr)} т</div>
              <div className="text-[10px] text-slate-400">сырьё: {fmt(totalCorrInput)} т / продукция: {fmt(totalCorrOutput)} т</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-lg px-3 py-2">
              <div className="text-[10px] text-dark-muted uppercase tracking-wider">Скорректировано продуктов</div>
              <div className="text-lg font-bold text-dark-text tabular-nums">{corrected.length} <span className="text-sm font-normal text-dark-muted">из {allProducts.length}</span></div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-lg px-3 py-2">
              <div className="text-[10px] text-dark-muted uppercase tracking-wider">Крупные корр. (&gt;3%)</div>
              <div className={`text-lg font-bold tabular-nums ${bigCorrections.length > 0 ? 'text-accent-red' : 'text-accent-green'}`}>{bigCorrections.length}</div>
            </div>
          </div>

          {/* Products table */}
          {corrected.length > 0 && (
            <div className="overflow-x-auto border border-slate-600/50 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className={`${thCls} text-xs`}>Продукт</th>
                    <th className={`${thCls} text-xs`}>Тип</th>
                    <th className={`${thCls} text-xs text-right`}>Замер (т)</th>
                    <th className={`${thCls} text-xs text-right`}>Согласов (т)</th>
                    <th className={`${thCls} text-xs text-right`}>Корр. (т)</th>
                    <th className={`${thCls} text-xs text-right`}>Корр. (%)<InfoTooltip text="Δ = (согласовано − замер) / замер × 100%" /></th>
                    <th className={`${thCls} text-xs w-28`}>Масштаб</th>
                  </tr>
                </thead>
                <tbody>
                  {corrected.map((p, i) => {
                    const pct = p.delta_pct ?? 0
                    const absPct = Math.abs(pct)
                    const isHigh = absPct > 3
                    const barWidth = maxDelta > 0 ? Math.min(100, (absPct / maxDelta) * 100) : 0
                    const dColor = absPct > 5 ? 'text-accent-red font-medium' : absPct > 2 ? 'text-accent-yellow' : 'text-dark-muted'
                    return (
                      <tr key={i} className={isHigh ? 'bg-accent-red/5' : 'bg-[#0a1225]'}>
                        <td className={`${tdCls} text-dark-text font-medium`}>{p.product}</td>
                        <td className={tdCls}>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.direction === 'Сырьё' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-accent-green/10 text-accent-green'
                          }`}>{p.direction}</span>
                        </td>
                        <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{fmt(p.measured)}</td>
                        <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{fmt(p.reconciled)}</td>
                        <td className={`${tdCls} text-right tabular-nums ${dColor}`}>{fmtDelta(p.delta_tons)}</td>
                        <td className={`${tdCls} text-right tabular-nums ${dColor}`}>{fmtDeltaPct(pct)}</td>
                        <td className={tdCls}>
                          <div className="w-full bg-slate-700/30 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${isHigh ? 'bg-accent-red' : 'bg-accent-yellow'}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Conclusion */}
          {bigCorrections.length > 0 && (
            <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-300 leading-relaxed">
                <span className="text-accent-red font-semibold">Вывод: </span>
                {bigCorrections.length === 1
                  ? `Продукт «${bigCorrections[0].product}» (${bigCorrections[0].direction.toLowerCase()}) скорректирован на ${fmtPct(bigCorrections[0].delta_pct)}% — основной источник расхождения.`
                  : `${bigCorrections.length} продукт(ов) скорректировано более чем на 3%: ${bigCorrections.slice(0, 3).map(p => `«${p.product}» ${fmtPct(p.delta_pct)}%`).join(', ')}${bigCorrections.length > 3 ? ` и ещё ${bigCorrections.length - 3}` : ''}.`
                }
                {' '}Рекомендуется проверить показания приборов учёта по этим позициям.
              </p>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

function MethodDetailTable({ method, items, unitName, unitCode }) {
  const [expandedDate, setExpandedDate] = useState(null)
  const { sortCol, sortDir, toggle } = useSortTable()
  const isBalanceClosure = method === 'balance_closure'
  const isReconGap = method === 'recon_gap'
  const isSpc = method === 'spc'
  const isCrossUnit = method === 'cross_unit'
  const cfg = methodConfig[method]
  const Icon = cfg?.icon

  const reconColCount = 9
  const totalCols = isReconGap ? reconColCount + 1 : isBalanceClosure ? 8 : isSpc ? 6 : isCrossUnit ? 8 : 5

  const getVal = (item, col) => {
    if (col === '_loss') return (item.output_value ?? 0) - (item.input_value ?? 0)
    return item[col]
  }
  const sorted = sortData(items, sortCol, sortDir, getVal)
  const sp = { sortCol, sortDir, onSort: toggle }

  return (
    <div className="bg-[#080e20] px-6 py-3 border-b border-dark-border/30">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-dark-text flex items-center gap-2">
            {Icon && <Icon size={18} className={cfg.color} />}
            {cfg?.label || method} ({items.length} событий)
          </h4>
          <button
            onClick={() => exportOverviewExcel(items, method)}
            className="flex items-center gap-1 px-2 py-1 text-sm bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
          >
            <Download size={12} />
            Excel
          </button>
        </div>

        <div className="overflow-x-auto overflow-y-auto border border-slate-600 rounded-lg">
          <table className="w-full text-sm min-w-max">
            <thead className="sticky top-0 bg-dark-card z-10">
              <tr className="text-left text-slate-300">
                <SortTh col="date" {...sp} className={thCls}>Дата</SortTh>
                {isBalanceClosure && (
                  <>
                    <SortTh col="input_measured" {...sp} className={`${thCls} text-right`}>Вход сырья изм (т)</SortTh>
                    <SortTh col="input_reconciled" {...sp} className={`${thCls} text-right`}>Вход сырья согл (т)</SortTh>
                    <SortTh col="output_measured" {...sp} className={`${thCls} text-right`}>Выход продукции изм (т)</SortTh>
                    <SortTh col="output_reconciled" {...sp} className={`${thCls} text-right`}>Выход продукции согл (т)</SortTh>
                    <SortTh col="delta_tons" {...sp} className={`${thCls} text-right`}>Небаланс (т)</SortTh>
                    <SortTh col="delta_pct" {...sp} className={`${thCls} text-right`}>Небаланс (%)<InfoTooltip text="(вход − выход) / вход × 100%" /></SortTh>
                  </>
                )}
                {isReconGap && (
                  <>
                    <SortTh col="input_measured" {...sp} className={`${thCls} text-right`}>Сырьё изм (т)</SortTh>
                    <SortTh col="input_reconciled" {...sp} className={`${thCls} text-right`}>Сырьё согл (т)</SortTh>
                    <SortTh col="delta_input_tons" {...sp} className={`${thCls} text-right`}>Δ сырьё (т)</SortTh>
                    <SortTh col="delta_input_pct" {...sp} className={`${thCls} text-right`}>Δ сырьё (%)<InfoTooltip text="|замер − согласовано| / замер × 100%" /></SortTh>
                    <SortTh col="output_measured" {...sp} className={`${thCls} text-right`}>Продукция изм (т)</SortTh>
                    <SortTh col="output_reconciled" {...sp} className={`${thCls} text-right`}>Продукция согл (т)</SortTh>
                    <SortTh col="delta_output_tons" {...sp} className={`${thCls} text-right`}>Δ продукц (т)</SortTh>
                    <SortTh col="delta_output_pct" {...sp} className={`${thCls} text-right`}>Δ продукц (%)<InfoTooltip text="|замер − согласовано| / замер × 100%" /></SortTh>
                  </>
                )}
                {isSpc && (
                  <>
                    <SortTh col="consumed" {...sp} className={`${thCls} text-right`}>Загрузка (т)</SortTh>
                    <SortTh col="produced" {...sp} className={`${thCls} text-right`}>Выпуск (т)</SortTh>
                    <SortTh col="mean" {...sp} className={`${thCls} text-right`}>Среднее (т)</SortTh>
                    <SortTh col="value" {...sp} className={`${thCls} text-right`}>Отклонение (σ)<InfoTooltip text="Число стандартных отклонений от среднего за период." /></SortTh>
                  </>
                )}
                {isCrossUnit && (
                  <>
                    <SortTh col="product" {...sp} className={thCls}>Продукт</SortTh>
                    <SortTh col="source_unit_name" {...sp} className={thCls}>Откуда</SortTh>
                    <SortTh col="target_unit_name" {...sp} className={thCls}>Куда</SortTh>
                    <SortTh col="output_value" {...sp} className={`${thCls} text-right`}>Отдано (т)</SortTh>
                    <SortTh col="input_value" {...sp} className={`${thCls} text-right`}>Принято (т)</SortTh>
                    <SortTh col="_loss" {...sp} className={`${thCls} text-right`}>Потери (т)</SortTh>
                    <SortTh col="value" {...sp} className={`${thCls} text-right`}>Δ%<InfoTooltip text="(отдано − принято) / отдано × 100%" /></SortTh>
                  </>
                )}
                {!isBalanceClosure && !isReconGap && !isSpc && !isCrossUnit && (
                  <>
                    <SortTh col="description" {...sp} className={thCls}>Описание</SortTh>
                    <SortTh col="value" {...sp} className={`${thCls} text-right`}>Значение</SortTh>
                    <SortTh col="threshold" {...sp} className={`${thCls} text-right`}>Порог</SortTh>
                  </>
                )}
                <SortTh col="severity" {...sp} className={thCls}>Уровень</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => {
                const canExpand = isReconGap || isBalanceClosure || isSpc
                const isDateExpanded = canExpand && expandedDate === a.date
                return (
                  <React.Fragment key={i}>
                    <tr
                      className={`hover:bg-white/5 ${canExpand ? 'cursor-pointer' : ''} ${isDateExpanded ? 'bg-accent-blue/5' : ''}`}
                      onClick={canExpand ? () => setExpandedDate(isDateExpanded ? null : a.date) : undefined}
                    >
                      <td className={`${tdCls} text-dark-text whitespace-nowrap`}>
                        {canExpand && <span className="mr-1 text-dark-muted">{isDateExpanded ? '▾' : '▸'}</span>}
                        {fmtDate(a.date)}
                      </td>
                      {isBalanceClosure && (
                        <>
                          <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{(a.input_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{(a.input_reconciled ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{(a.output_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{(a.output_reconciled ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
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
                          <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(a.mean ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.value ?? 0).toFixed(2)}σ</td>
                        </>
                      )}
                      {isCrossUnit && (
                        <>
                          <td className={`${tdCls} text-dark-text`}>{a.product}</td>
                          <td className={`${tdCls} text-dark-text`}>{a.source_unit_name || '—'}</td>
                          <td className={`${tdCls} text-dark-text`}>{a.target_unit_name || '—'}</td>
                          <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(a.output_value ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(a.input_value ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{((a.output_value ?? 0) - (a.input_value ?? 0)).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                          <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.value ?? 0).toFixed(1)}%</td>
                        </>
                      )}
                      {!isBalanceClosure && !isReconGap && !isSpc && !isCrossUnit && (
                        <>
                          <td className={`${tdCls} text-slate-300`}>{a.description}</td>
                          <td className={`${tdCls} text-right tabular-nums text-dark-text`}>{a.value}</td>
                          <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{a.threshold}</td>
                        </>
                      )}
                      <td className={tdCls}>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          a.severity === 'critical' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-yellow/10 text-accent-yellow'
                        }`}>
                          {a.severity === 'critical' ? 'Критично' : 'Внимание'}
                        </span>
                      </td>
                    </tr>
                    {isDateExpanded && (
                      <ProductsSubRow
                        unitCode={unitCode || a.unit}
                        dateStr={a.date}
                        unitName={unitName}
                        colSpan={totalCols}
                        method={method}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
