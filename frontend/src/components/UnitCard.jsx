import { useState, useMemo } from 'react'
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

const methodMeta = {
  balance_closure: { label: 'Небаланс вход/выход', icon: AlertTriangle, color: 'text-accent-red' },
  recon_gap: { label: 'Расхождение измерено/согласовано', icon: BarChart3, color: 'text-accent-yellow' },
  spc: { label: 'Нетипичные дни', icon: Activity, color: 'text-accent-blue' },
  downtime: { label: 'Простой', icon: Clock, color: 'text-dark-muted' },
  cross_unit: { label: 'Потери продукции между установками', icon: GitBranch, color: 'text-accent-green' },
}

function exportDowntimeExcel(events, unitName) {
  if (!events || events.length === 0) return
  const rows = events.map(e => ({
    'Начало': e.start_date,
    'Конец': e.end_date,
    'Дней': e.days,
    'Тип': e.type === 'stop' ? 'Полный простой' : 'Сниженная загрузка',
    'Загрузка (% от нормы)': e.avg_load_pct,
    'Потери сырья (т)': e.lost_input_tons,
    'Потери продукции (т)': e.lost_output_tons,
    'Обоснование': e.reason,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 70 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Простои')
  XLSX.writeFile(wb, `Простои_${unitName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportAnomaliesExcel(anomalies, unitName, methodLabel) {
  if (!anomalies || anomalies.length === 0) return
  const rows = anomalies.map(a => {
    const row = {
      'Дата': a.date,
      'Тип': methodMeta[a.method]?.label || a.method,
    }
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
  XLSX.utils.book_append_sheet(wb, ws, 'Аномалии')
  XLSX.writeFile(wb, `${methodLabel}_${unitName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function UnitCard({ unit, anomalies = [], activeMethod = null }) {
  const [expanded, setExpanded] = useState(false)
  const [openSection, setOpenSection] = useState(null) // which method accordion is open
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
    enabled: openSection === 'downtime',
  })

  const unitAnomalies = useMemo(() =>
    anomalies.filter(a => a.unit === unit.code || a.unit_name === unit.name),
    [anomalies, unit.code, unit.name]
  )

  // Group anomalies by method
  const anomaliesByMethod = useMemo(() => {
    const groups = {}
    unitAnomalies.forEach(a => {
      if (!groups[a.method]) groups[a.method] = []
      groups[a.method].push(a)
    })
    return groups
  }, [unitAnomalies])

  // If activeMethod is set, check if this unit has related anomalies
  const hasActiveMethodAnomalies = activeMethod ? (anomaliesByMethod[activeMethod]?.length > 0) : true
  // Auto-open section when activeMethod changes
  const effectiveOpenSection = activeMethod && hasActiveMethodAnomalies ? activeMethod : openSection

  const fmt = (v) => Math.abs(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })

  // Don't render card if activeMethod is set and this unit has no matching anomalies
  if (activeMethod && !hasActiveMethodAnomalies) return null

  const toggleSection = (method) => {
    setOpenSection(prev => prev === method ? null : method)
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
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-3" style={{ fontSize: '12px', color: '#94a3b8' }}>
          <div className="flex justify-between"><span>Сырьё (замер)</span><span className="tabular-nums font-medium">{fmt(unit.input_measured || 0)} т</span></div>
          <div className="flex justify-between"><span>Продукция (замер)</span><span className="tabular-nums font-medium">{fmt(unit.output_measured || 0)} т</span></div>
          <div className="flex justify-between"><span>Сырьё (согл)</span><span className="tabular-nums font-medium">{fmt(unit.input_reconciled || 0)} т</span></div>
          <div className="flex justify-between"><span>Продукция (согл)</span><span className="tabular-nums font-medium">{fmt(unit.output_reconciled || 0)} т</span></div>
        </div>

        {/* Delta */}
        <div className="grid grid-cols-2 gap-x-6 mt-2" style={{ fontSize: '12px' }}>
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
                  <span>Δ Сырьё:</span>
                  <span className="tabular-nums font-medium">{sign(di)}{fmt(di)} т ({sign(dip)}{Math.abs(dip).toFixed(2)}%)</span>
                </div>
                <div className="flex justify-between" style={{ color: colorOut }}>
                  <span>Δ Продукция:</span>
                  <span className="tabular-nums font-medium">{sign(do_)}{fmt(do_)} т ({sign(dop)}{Math.abs(dop).toFixed(2)}%)</span>
                </div>
              </>
            )
          })()}
        </div>

        {/* Anomaly method badges — clickable */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {Object.entries(anomaliesByMethod).map(([method, items]) => {
            const meta = methodMeta[method]
            if (!meta) return null
            const Icon = meta.icon
            const isOpen = effectiveOpenSection === method
            return (
              <button
                key={method}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!expanded) setExpanded(true)
                  toggleSection(method)
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all border ${
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
        <div className="flex items-center gap-1 mt-3 text-xs text-dark-muted">
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
              {/* Downtime accordion */}
              {effectiveOpenSection === 'downtime' && (
                <DowntimeSection
                  data={downtimeData}
                  unitName={unit.name}
                />
              )}

              {/* Other method accordions */}
              {effectiveOpenSection && effectiveOpenSection !== 'downtime' && anomaliesByMethod[effectiveOpenSection] && (
                <AnomalyMethodSection
                  method={effectiveOpenSection}
                  anomalies={anomaliesByMethod[effectiveOpenSection]}
                  unitName={unit.name}
                />
              )}

              {/* Charts — show if no specific method is selected or method needs charts */}
              {(!effectiveOpenSection || effectiveOpenSection === 'spc') && detail.spc?.dates?.length > 0 && (
                <ChartWrapper chartId="control" title="Нетипичные дни (отклонения загрузки)">
                  {(res) => <ControlChart spcData={detail.spc} resolved={res} />}
                </ChartWrapper>
              )}
              {(!effectiveOpenSection || effectiveOpenSection === 'recon_gap') && detail.recon_gap?.dates?.length > 0 && (
                <ChartWrapper chartId="recon-gap" title="Расхождение измерено / согласовано">
                  {(res) => <ReconGapChart reconData={detail.recon_gap} resolved={res} />}
                </ChartWrapper>
              )}
              {/* Products & Heatmaps — always if no method filter */}
              {!effectiveOpenSection && (
                <>
                  <ProductsTable products={detail.products} />
                  <ReconHeatmap unitCode={unit.code} direction="inputs" title="Расхождение замер/согл — Сырьё (входящие)" dateParams={dateParams} />
                  <ReconHeatmap unitCode={unit.code} direction="outputs" title="Расхождение замер/согл — Продукция (исходящие)" dateParams={dateParams} />
                </>
              )}

              {/* Full anomaly list — if no specific method selected */}
              {!effectiveOpenSection && unitAnomalies.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-dark-muted mb-2">
                    Все аномалии ({unitAnomalies.length})
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {unitAnomalies.slice(0, 20).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                        <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-accent-red' : 'bg-accent-yellow'}`} />
                        <span className="text-dark-muted shrink-0">{a.date?.slice(5)}</span>
                        <span className="text-dark-text">{a.description}</span>
                      </div>
                    ))}
                    {unitAnomalies.length > 20 && (
                      <div className="text-xs text-dark-muted">...и ещё {unitAnomalies.length - 20}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-dark-muted py-1">Данные не найдены</div>
          )}
        </div>
      )}
    </div>
  )
}

function DowntimeSection({ data, unitName }) {
  if (!data) return <div className="text-sm text-dark-muted">Загрузка простоев...</div>
  const events = data.events || []
  if (events.length === 0) return <div className="text-sm text-dark-muted">Простоев не обнаружено</div>

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-dark-text flex items-center gap-2">
          <Clock size={15} className="text-accent-yellow" />
          Простои и снижение загрузки ({events.length} событий)
        </h4>
        <button
          onClick={() => exportDowntimeExcel(events, unitName)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
        >
          <Download size={12} />
          Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dark-border text-left text-dark-muted">
              <th className="px-2 py-1.5">Начало</th>
              <th className="px-2 py-1.5">Конец</th>
              <th className="px-2 py-1.5 text-right">Дней</th>
              <th className="px-2 py-1.5">Тип</th>
              <th className="px-2 py-1.5 text-right">% от нормы</th>
              <th className="px-2 py-1.5 text-right">Потери сырья</th>
              <th className="px-2 py-1.5 text-right">Потери продукции</th>
              <th className="px-2 py-1.5">Обоснование</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className="border-b border-dark-border/30 hover:bg-white/5">
                <td className="px-2 py-1.5 text-dark-text whitespace-nowrap">{e.start_date}</td>
                <td className="px-2 py-1.5 text-dark-text whitespace-nowrap">{e.end_date}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-dark-text">{e.days}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    e.type === 'stop' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-yellow/10 text-accent-yellow'
                  }`}>
                    {e.type === 'stop' ? 'Остановка' : 'Снижение'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className={e.avg_load_pct < 10 ? 'text-accent-red' : 'text-accent-yellow'}>{e.avg_load_pct}%</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-accent-red">{e.lost_input_tons.toLocaleString('ru-RU')} т</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-accent-red">{e.lost_output_tons.toLocaleString('ru-RU')} т</td>
                <td className="px-2 py-1.5 text-dark-muted max-w-xs">{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnomalyMethodSection({ method, anomalies, unitName }) {
  const meta = methodMeta[method]
  if (!meta || !anomalies || anomalies.length === 0) return null
  const Icon = meta.icon
  const isBalance = method === 'balance_closure' || method === 'recon_gap'
  const isSpc = method === 'spc'

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-dark-text flex items-center gap-2">
          <Icon size={15} className={meta.color} />
          {meta.label} ({anomalies.length} событий)
        </h4>
        <button
          onClick={() => exportAnomaliesExcel(anomalies, unitName, meta.label)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20"
        >
          <Download size={12} />
          Excel
        </button>
      </div>

      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-dark-card">
            <tr className="border-b border-dark-border text-left text-dark-muted">
              <th className="px-2 py-1.5">Дата</th>
              {isBalance && (
                <>
                  <th className="px-2 py-1.5 text-right">Вход изм (т)</th>
                  <th className="px-2 py-1.5 text-right">Вход согл (т)</th>
                  <th className="px-2 py-1.5 text-right">Выход изм (т)</th>
                  <th className="px-2 py-1.5 text-right">Выход согл (т)</th>
                  <th className="px-2 py-1.5 text-right">Δ (т)</th>
                  <th className="px-2 py-1.5 text-right">Δ (% от изм)</th>
                </>
              )}
              {isSpc && (
                <>
                  <th className="px-2 py-1.5 text-right">Загрузка (т)</th>
                  <th className="px-2 py-1.5 text-right">Выпуск (т)</th>
                  <th className="px-2 py-1.5 text-right">Среднее (т)</th>
                  <th className="px-2 py-1.5 text-right">Отклонение (σ)</th>
                </>
              )}
              {!isBalance && !isSpc && (
                <>
                  <th className="px-2 py-1.5">Описание</th>
                  <th className="px-2 py-1.5 text-right">Значение</th>
                  <th className="px-2 py-1.5 text-right">Порог</th>
                </>
              )}
              <th className="px-2 py-1.5">Уровень</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a, i) => (
              <tr key={i} className="border-b border-dark-border/30 hover:bg-white/5">
                <td className="px-2 py-1.5 text-dark-text whitespace-nowrap">{a.date}</td>
                {isBalance && (
                  <>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-muted">{(a.input_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-text">{(a.input_reconciled ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-muted">{(a.output_measured ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-text">{(a.output_reconciled ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-accent-red font-medium">{(a.delta_tons ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-accent-red font-medium">{(a.delta_pct ?? 0).toFixed(2)}%</td>
                  </>
                )}
                {isSpc && (
                  <>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-text">{(a.consumed ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-text">{(a.produced ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-muted">{(a.mean ?? 0).toLocaleString('ru-RU', {maximumFractionDigits:1})}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-accent-red font-medium">{(a.value ?? 0).toFixed(2)}σ</td>
                  </>
                )}
                {!isBalance && !isSpc && (
                  <>
                    <td className="px-2 py-1.5 text-dark-muted">{a.description}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-text">{a.value}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-dark-muted">{a.threshold}</td>
                  </>
                )}
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
  )
}

function PlanBar({ label, pct, fact, plan, fmt }) {
  const barWidth = Math.min(100, pct)
  const color = pct >= 95 ? '#4ade80' : pct >= 80 ? '#fbbf24' : '#f87171'
  return (
    <div>
      <div className="text-xs text-dark-muted mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-6 bg-dark-border/50 rounded-full overflow-hidden relative">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: color }} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold tabular-nums drop-shadow-sm">{fmt(fact)} из {fmt(plan)} т</span>
        </div>
        <span className="text-lg font-bold tabular-nums w-16 text-right" style={{ color }}>{pct.toFixed(1)}%</span>
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
      <div className="text-sm font-medium text-dark-text mb-3">Продукты и сырьё</div>
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
      <div className={`text-xs font-semibold ${titleColor} mb-2`}>{title} — {items.length} поз.</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dark-border text-dark-muted">
              <th className="text-left py-1.5 pr-2">Продукт</th>
              <th className="text-right py-1.5 px-1">Доля</th>
              <th className="text-right py-1.5 px-1">Замер (т)</th>
              <th className="text-right py-1.5 px-1">Согл (т)</th>
              <th className="text-right py-1.5 px-1">&Delta; (т)</th>
              <th className="text-right py-1.5 pl-1">&Delta; (%)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => {
              const devTons = p.delta_tons != null ? Math.abs(p.delta_tons) : Math.abs((p.measured || 0) - (p.reconciled || 0))
              const devPct = p.delta_pct != null ? Math.abs(p.delta_pct) : (p.measured ? Math.abs(p.measured - p.reconciled) / Math.abs(p.measured) * 100 : 0)
              const isHigh = devPct > 5
              return (
                <tr key={i} className="border-b border-dark-border/30 hover:bg-white/5">
                  <td className="py-1.5 pr-2 text-dark-text truncate max-w-[180px]" title={p.product}>{p.product}</td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-dark-muted">{(p.share_pct != null ? p.share_pct : 0).toFixed(1)}%</td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-dark-muted">{(p.measured || 0).toFixed(1)}</td>
                  <td className={`py-1.5 px-1 text-right tabular-nums font-medium ${reconColor}`}>{(p.reconciled || 0).toFixed(1)}</td>
                  <td className={`py-1.5 px-1 text-right tabular-nums ${isHigh ? 'text-accent-red font-semibold' : 'text-dark-muted'}`}>{devTons.toFixed(1)}</td>
                  <td className={`py-1.5 pl-1 text-right tabular-nums ${isHigh ? 'text-accent-red font-semibold' : 'text-dark-muted'}`}>{devPct.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
