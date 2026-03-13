import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Factory, FileText, Download, Clock, AlertTriangle, BarChart3, Activity, GitBranch } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ChartWrapper from './ChartWrapper'
import ControlChart from './ControlChart'
import ReconGapChart from './ReconGapChart'
// CusumChart removed
import ReconHeatmap from './ReconHeatmap'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'
import * as XLSX from 'xlsx'

function downloadXlsx(wb, filename) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const methodMeta = {
  balance_closure: { label: 'Небаланс вход/выход', icon: AlertTriangle, color: 'text-accent-red' },
  recon_gap: { label: 'Расхождение измерено/согласовано', icon: BarChart3, color: 'text-accent-yellow' },
  spc: { label: 'Нетипичные дни', icon: Activity, color: 'text-accent-blue' },
  downtime: { label: 'Простой', icon: Clock, color: 'text-dark-muted' },
  cross_unit: { label: 'Потери продукции между установками', icon: GitBranch, color: 'text-accent-green' },
}

/* ---- cell border classes ---- */
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
    { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 7 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 70 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Простои')
  downloadXlsx(wb, `Простои_${unitName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportAnomaliesExcel(anomalies, unitName, method) {
  if (!anomalies || anomalies.length === 0) return
  const label = methodMeta[method]?.label || method
  const sev = a => a.severity === 'critical' ? 'Критично' : 'Внимание'
  const rows = anomalies.map(a => {
    if (method === 'balance_closure') return {
      'Дата': a.date, 'Вход сырья изм (т)': a.input_measured, 'Выход продукции изм (т)': a.output_measured,
      'Небаланс (т)': a.delta_tons, 'Небаланс (%)': a.delta_pct, 'Уровень': sev(a),
    }
    if (method === 'recon_gap') return {
      'Дата': a.date, 'Сырьё изм (т)': a.input_measured, 'Сырьё согл (т)': a.input_reconciled,
      'Δ сырьё (т)': a.delta_input_tons, 'Δ сырьё (%)': a.delta_input_pct,
      'Продукция изм (т)': a.output_measured, 'Продукция согл (т)': a.output_reconciled,
      'Δ продукц (т)': a.delta_output_tons, 'Δ продукц (%)': a.delta_output_pct, 'Уровень': sev(a),
    }
    if (method === 'spc') return {
      'Дата': a.date, 'Загрузка (т)': a.consumed, 'Выпуск (т)': a.produced,
      'Среднее (т)': a.mean, 'Отклонение (σ)': a.value, 'Уровень': sev(a),
    }
    if (method === 'cross_unit') return {
      'Дата': a.date, 'Продукт': a.product, 'Откуда': a.source_unit_name, 'Куда': a.target_unit_name,
      'Отдано (т)': a.output_value, 'Принято (т)': a.input_value,
      'Потери (т)': Math.round(((a.output_value ?? 0) - (a.input_value ?? 0)) * 10) / 10,
      'Δ%': a.value, 'Уровень': sev(a),
    }
    return { 'Дата': a.date, 'Описание': a.description, 'Значение': a.value, 'Порог': a.threshold, 'Уровень': sev(a) }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
  downloadXlsx(wb, `${label}_${unitName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function UnitCard({ unit, anomalies = [], activeMethod = null }) {
  const [expanded, setExpanded] = useState(false)
  const [openSections, setOpenSections] = useState(new Set())
  const navigate = useNavigate()
  const { dateParams } = useDateFilter()

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['unit', unit.code, dateParams],
    queryFn: () => api.get(`/units/${encodeURIComponent(unit.code)}`, { params: dateParams }).then(r => r.data),
    enabled: expanded,
  })

  const { data: downtimeData } = useQuery({
    queryKey: ['downtimeUnit', unit.code, dateParams],
    queryFn: () => api.get('/anomalies/downtime-details', { params: { unit: unit.code, ...dateParams } }).then(r => r.data),
    enabled: openSections.has('downtime'),
  })

  const unitAnomalies = useMemo(() =>
    anomalies.filter(a => a.unit === unit.code || a.unit_name === unit.name),
    [anomalies, unit.code, unit.name]
  )

  const anomaliesByMethod = useMemo(() => {
    const groups = {}
    unitAnomalies.forEach(a => {
      if (!groups[a.method]) groups[a.method] = []
      groups[a.method].push(a)
    })
    return groups
  }, [unitAnomalies])

  const hasActiveMethodAnomalies = activeMethod ? (anomaliesByMethod[activeMethod]?.length > 0) : true

  // Compute effective open sections: user-opened + activeMethod
  const effectiveOpenSections = useMemo(() => {
    const s = new Set(openSections)
    if (activeMethod && hasActiveMethodAnomalies) s.add(activeMethod)
    return s
  }, [openSections, activeMethod, hasActiveMethodAnomalies])

  const fmt = (v) => Math.abs(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })

  if (activeMethod && !hasActiveMethodAnomalies) return null

  const toggleSection = (method) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(method)) next.delete(method)
      else next.add(method)
      return next
    })
  }

  return (
    <div className={`bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-dark-muted/50 transition-colors ${expanded ? 'col-span-full' : ''}`}>
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Factory size={20} className="text-accent-blue shrink-0" />
            <h3 className="text-base font-bold text-dark-text truncate">{unit.name}</h3>
          </div>
          <StatusBadge status={unit.status} />
        </div>

        {/* Plan bars */}
        <div className="space-y-4">
          <PlanBar label="Загрузка сырья (план/факт)" pct={unit.plan_pct_input || 0} fact={unit.fact_input_tons || 0} plan={unit.plan_input_tons || 0} fmt={fmt} />
          <PlanBar label="Выпуск продукции (план/факт)" pct={unit.plan_pct_output || 0} fact={unit.fact_output_tons || 0} plan={unit.plan_output_tons || 0} fmt={fmt} />
        </div>

        {/* Measured / Reconciled actuals */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-3" style={{ fontSize: '14px', color: '#cbd5e1' }}>
          <div className="flex justify-between"><span>Сырьё (замер)</span><span className="tabular-nums font-medium">{fmt(unit.input_measured || 0)} т</span></div>
          <div className="flex justify-between"><span>Продукция (замер)</span><span className="tabular-nums font-medium">{fmt(unit.output_measured || 0)} т</span></div>
          <div className="flex justify-between"><span>Сырьё (согл)</span><span className="tabular-nums font-medium">{fmt(unit.input_reconciled || 0)} т</span></div>
          <div className="flex justify-between"><span>Продукция (согл)</span><span className="tabular-nums font-medium">{fmt(unit.output_reconciled || 0)} т</span></div>
        </div>

        {/* Delta */}
        <div className="grid grid-cols-2 gap-x-6 mt-2" style={{ fontSize: '14px' }}>
          {(() => {
            const di = unit.delta_input_tons || 0
            const dip = unit.delta_input_pct || 0
            const do_ = unit.delta_output_tons || 0
            const dop = unit.delta_output_pct || 0
            const colorIn = di < 0 ? '#f87171' : '#f59e0b'
            const colorOut = do_ < 0 ? '#f87171' : '#f59e0b'
            const sign = (v) => v > 0 ? '+' : v < 0 ? '−' : ''
            return (
              <>
                <div className="flex justify-between" style={{ color: colorIn }}>
                  <span>Δ Сырьё (замер−согл):</span>
                  <span className="tabular-nums font-medium">{sign(di)}{fmt(di)} т ({sign(dip)}{Math.abs(dip).toFixed(2)}%)</span>
                </div>
                <div className="flex justify-between" style={{ color: colorOut }}>
                  <span>Δ Продукция (замер−согл):</span>
                  <span className="tabular-nums font-medium">{sign(do_)}{fmt(do_)} т ({sign(dop)}{Math.abs(dop).toFixed(2)}%)</span>
                </div>
              </>
            )
          })()}
        </div>

        {/* Anomaly method badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {Object.entries(anomaliesByMethod).map(([method, items]) => {
            const meta = methodMeta[method]
            if (!meta) return null
            const Icon = meta.icon
            const isOpen = effectiveOpenSections.has(method)
            return (
              <button
                key={method}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!expanded) setExpanded(true)
                  toggleSection(method)
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-all border ${
                  isOpen
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-dark-border text-dark-muted hover:border-dark-muted hover:text-dark-text'
                }`}
              >
                <Icon size={12} />
                <span>{meta.label}</span>
                <span className="font-bold">{items.length}</span>
              </button>
            )
          })}
          {unit.anomaly_count > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/unit/${encodeURIComponent(unit.code)}`)
              }}
              className="p-1 rounded hover:bg-white/10 text-dark-muted hover:text-dark-text"
              title="Подробная аналитика"
            >
              <FileText size={14} />
            </button>
          )}
        </div>

        {/* Expand toggle */}
        <div className="flex items-center gap-1 mt-3 text-sm text-dark-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{expanded ? 'Свернуть' : 'Развернуть аналитику'}</span>
        </div>
      </div>

      {/* Expanded analytics */}
      {expanded && (
        <div className="border-t border-dark-border bg-[#080e20] px-5 py-4 space-y-4">
          {detailLoading ? (
            <div className="text-sm text-dark-muted py-3">Загрузка аналитики...</div>
          ) : detail ? (
            <>
              {/* Method accordions — multiple can be open */}
              {Array.from(effectiveOpenSections).map(section => {
                if (section === 'downtime') {
                  return <DowntimeSection key={section} data={downtimeData} unitName={unit.name} />
                }
                if (anomaliesByMethod[section]) {
                  return (
                    <AnomalyMethodSection
                      key={section}
                      method={section}
                      anomalies={anomaliesByMethod[section]}
                      unitName={unit.name}
                      unitCode={unit.code}
                    />
                  )
                }
                return null
              })}

              {/* Charts — always visible */}
              {detail.spc?.dates?.length > 0 && (
                <ChartWrapper chartId="control" title="Нетипичные дни (отклонения загрузки)">
                  {(res) => <ControlChart spcData={detail.spc} resolved={res} />}
                </ChartWrapper>
              )}
              {detail.recon_gap?.dates?.length > 0 && (
                <ChartWrapper chartId="recon-gap" title="Расхождение измерено / согласовано">
                  {(res) => <ReconGapChart reconData={detail.recon_gap} resolved={res} />}
                </ChartWrapper>
              )}
              {/* Products & Heatmaps — always visible */}
              <ProductsTable products={detail.products} />
              <ReconHeatmap unitCode={unit.code} direction="inputs" title="Расхождение замер/согл — Сырьё (входящие)" dateParams={dateParams} />
              <ReconHeatmap unitCode={unit.code} direction="outputs" title="Расхождение замер/согл — Продукция (исходящие)" dateParams={dateParams} />

            </>
          ) : (
            <div className="text-xs text-dark-muted py-1">Данные не найдены</div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDuration(days) {
  const hours = days * 24
  if (days === 1) return '1 дн (24 ч)'
  return `${days} дн (${hours} ч)`
}

function DowntimeSection({ data, unitName }) {
  const { sortCol, sortDir, toggle } = useSortTable()
  if (!data) return <div className="text-sm text-dark-muted">Загрузка простоев...</div>
  const events = data.events || []
  if (events.length === 0) return <div className="text-sm text-dark-muted">Простоев не обнаружено</div>

  const totalLostOutput = events.reduce((s, e) => s + (e.lost_output_tons ?? 0), 0)
  const sorted = sortData(events, sortCol, sortDir)
  const sp = { sortCol, sortDir, onSort: toggle }

  return (
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
          className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
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
                  <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{e.start_date}</td>
                  <td className={`${tdCls} text-dark-text whitespace-nowrap`}>{e.end_date}</td>
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
  )
}

function exportProductsExcel(products, unitName, dateStr) {
  const rows = []
  ;['inputs', 'outputs'].forEach(dir => {
    const label = dir === 'inputs' ? 'Сырьё' : 'Продукция'
    ;(products[dir] || []).forEach(p => {
      rows.push({
        'Дата': dateStr,
        'Тип': label,
        'Продукт': p.product,
        'Замер (т)': p.measured,
        'Согласов (т)': p.reconciled,
        'Δ (т)': p.delta_tons,
        'Δ (%)': p.delta_pct,
      })
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

  const renderSection = (items, label, color, isInput) => items.length > 0 && (
    <>
      <tr>
        <td colSpan={colSpan} className="px-4 pt-2 pb-1">
          <span className={`text-xs font-semibold ${color}`}>{label} ({items.length} поз.)</span>
        </td>
      </tr>
      {items.map((p, j) => {
        const isHigh = p.delta_pct > 5
        const fmt = v => (v ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})
        return (
          <tr key={`${label}-${j}`} className="bg-[#0a1225]">
            <td className={`${tdCls} text-slate-200 pl-6`} title={p.product}>↳ {p.product}</td>
            {isBalance && (
              <>
                <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{isInput ? fmt(p.measured) : ''}</td>
                <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{!isInput ? fmt(p.measured) : ''}</td>
                <td className={tdCls} />
                <td className={tdCls} />
              </>
            )}
            {isRecon && (
              <>
                {isInput ? (
                  <>
                    <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{fmt(p.measured)}</td>
                    <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{fmt(p.reconciled)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${isHigh ? 'text-accent-red font-medium' : 'text-accent-yellow'}`}>{fmt(p.delta_tons)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${isHigh ? 'text-accent-red font-medium' : 'text-accent-yellow'}`}>{(p.delta_pct ?? 0).toFixed(2)}%</td>
                    <td colSpan={4} className={tdCls} />
                  </>
                ) : (
                  <>
                    <td colSpan={4} className={tdCls} />
                    <td className={`${tdCls} text-right tabular-nums text-accent-blue`}>{fmt(p.measured)}</td>
                    <td className={`${tdCls} text-right tabular-nums text-accent-green`}>{fmt(p.reconciled)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${isHigh ? 'text-accent-red font-medium' : 'text-accent-yellow'}`}>{fmt(p.delta_tons)}</td>
                    <td className={`${tdCls} text-right tabular-nums ${isHigh ? 'text-accent-red font-medium' : 'text-accent-yellow'}`}>{(p.delta_pct ?? 0).toFixed(2)}%</td>
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
            <span className="text-xs text-accent-blue font-semibold">Продукты за {dateStr}</span>
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

function AnomalyMethodSection({ method, anomalies, unitName, unitCode }) {
  const [expandedDate, setExpandedDate] = useState(null)
  const { sortCol, sortDir, toggle } = useSortTable()
  const meta = methodMeta[method]
  if (!meta || !anomalies || anomalies.length === 0) return null
  const Icon = meta.icon
  const isBalanceClosure = method === 'balance_closure'
  const isReconGap = method === 'recon_gap'
  const isSpc = method === 'spc'
  const isCrossUnit = method === 'cross_unit'

  const reconColCount = 9 // date + 8 recon cols
  const totalCols = isReconGap ? reconColCount + 1 : isBalanceClosure ? 6 : isSpc ? 6 : isCrossUnit ? 8 : 5

  const getVal = (item, col) => {
    if (col === '_loss') return (item.output_value ?? 0) - (item.input_value ?? 0)
    return item[col]
  }
  const sorted = sortData(anomalies, sortCol, sortDir, getVal)
  const sp = { sortCol, sortDir, onSort: toggle }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-dark-text flex items-center gap-2">
          <Icon size={18} className={meta.color} />
          {meta.label} ({anomalies.length} событий)
        </h4>
        <button
          onClick={() => exportAnomaliesExcel(anomalies, unitName, method)}
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
                  <SortTh col="output_measured" {...sp} className={`${thCls} text-right`}>Выход продукции изм (т)</SortTh>
                  <SortTh col="delta_tons" {...sp} className={`${thCls} text-right`}>Небаланс (т)</SortTh>
                  <SortTh col="delta_pct" {...sp} className={`${thCls} text-right`}>Небаланс (%)</SortTh>
                </>
              )}
              {isReconGap && (
                <>
                  <SortTh col="input_measured" {...sp} className={`${thCls} text-right`}>Сырьё изм (т)</SortTh>
                  <SortTh col="input_reconciled" {...sp} className={`${thCls} text-right`}>Сырьё согл (т)</SortTh>
                  <SortTh col="delta_input_tons" {...sp} className={`${thCls} text-right`}>Δ сырьё (т)</SortTh>
                  <SortTh col="delta_input_pct" {...sp} className={`${thCls} text-right`}>Δ сырьё (%)</SortTh>
                  <SortTh col="output_measured" {...sp} className={`${thCls} text-right`}>Продукция изм (т)</SortTh>
                  <SortTh col="output_reconciled" {...sp} className={`${thCls} text-right`}>Продукция согл (т)</SortTh>
                  <SortTh col="delta_output_tons" {...sp} className={`${thCls} text-right`}>Δ продукц (т)</SortTh>
                  <SortTh col="delta_output_pct" {...sp} className={`${thCls} text-right`}>Δ продукц (%)</SortTh>
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
                  <SortTh col="value" {...sp} className={`${thCls} text-right`}>Δ%</SortTh>
                </>
              )}
              {isSpc && (
                <>
                  <SortTh col="consumed" {...sp} className={`${thCls} text-right`}>Загрузка (т)</SortTh>
                  <SortTh col="produced" {...sp} className={`${thCls} text-right`}>Выпуск (т)</SortTh>
                  <SortTh col="mean" {...sp} className={`${thCls} text-right`}>Среднее (т)</SortTh>
                  <SortTh col="value" {...sp} className={`${thCls} text-right`}>Отклонение (σ)</SortTh>
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
                      {a.date}
                    </td>
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
                    {isSpc && (
                      <>
                        <td className={`${tdCls} text-right tabular-nums text-dark-text`}>{(a.consumed ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                        <td className={`${tdCls} text-right tabular-nums text-dark-text`}>{(a.produced ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                        <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(a.mean ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                        <td className={`${tdCls} text-right tabular-nums text-accent-red font-medium`}>{(a.value ?? 0).toFixed(2)}σ</td>
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
  )
}

function PlanBar({ label, pct, fact, plan, fmt }) {
  const barWidth = Math.min(100, pct)
  const color = pct >= 95 ? '#4ade80' : pct >= 80 ? '#fbbf24' : '#f87171'
  return (
    <div>
      <div className="text-sm text-dark-muted mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-14 bg-dark-border/50 rounded-full overflow-hidden relative">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: color }} />
          <span className="absolute inset-0 flex items-center justify-center text-base text-white font-bold tabular-nums drop-shadow-sm">{fmt(fact)} из {fmt(plan)} т</span>
        </div>
        <span className="text-xl font-bold tabular-nums w-20 text-right" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function ProductsTable({ products }) {
  if (!products) return null
  const hasInputs = products.inputs?.length > 0
  const hasOutputs = products.outputs?.length > 0
  if (!hasInputs && !hasOutputs) return null
  return (
    <div>
      <div className="text-lg font-bold text-dark-text mb-3">Продукты и сырьё</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasInputs && <ProductTable title="Сырьё (вход)" titleColor="text-accent-blue" items={products.inputs} reconColor="text-accent-green" />}
        {hasOutputs && <ProductTable title="Продукция (выход)" titleColor="text-accent-green" items={products.outputs} reconColor="text-accent-blue" />}
      </div>
    </div>
  )
}

function ProductTable({ title, titleColor, items, reconColor }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-3">
      <div className={`text-sm font-semibold ${titleColor} mb-2`}>{title} — {items.length} поз.</div>
      <div className="overflow-x-auto border border-slate-600 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-300">
              <th className={`${thCls} text-left`}>Продукт</th>
              <th className={`${thCls} text-right`}>Доля</th>
              <th className={`${thCls} text-right`}>Замер (т)</th>
              <th className={`${thCls} text-right`}>Согл (т)</th>
              <th className={`${thCls} text-right`}>&Delta; (т)</th>
              <th className={`${thCls} text-right`}>&Delta; (%)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => {
              const devTons = p.delta_tons != null ? Math.abs(p.delta_tons) : Math.abs((p.measured || 0) - (p.reconciled || 0))
              const devPct = p.delta_pct != null ? Math.abs(p.delta_pct) : (p.measured ? Math.abs(p.measured - p.reconciled) / Math.abs(p.measured) * 100 : 0)
              const isHigh = devPct > 5
              return (
                <tr key={i} className="hover:bg-white/5">
                  <td className={`${tdCls} text-dark-text truncate max-w-[180px]`} title={p.product}>{p.product}</td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(p.share_pct != null ? p.share_pct : 0).toFixed(1)}%</td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-300`}>{(p.measured || 0).toFixed(1)}</td>
                  <td className={`${tdCls} text-right tabular-nums font-medium ${reconColor}`}>{(p.reconciled || 0).toFixed(1)}</td>
                  <td className={`${tdCls} text-right tabular-nums ${isHigh ? 'text-accent-red font-semibold' : 'text-slate-300'}`}>{devTons.toFixed(1)}</td>
                  <td className={`${tdCls} text-right tabular-nums ${isHigh ? 'text-accent-red font-semibold' : 'text-slate-300'}`}>{devPct.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
