import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Factory, FileText } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ChartWrapper from './ChartWrapper'
import ControlChart from './ControlChart'
import ReconGapChart from './ReconGapChart'
import CusumChart from './CusumChart'
import ReconHeatmap from './ReconHeatmap'
import api from '../api/client'

export default function UnitCard({ unit, anomalies = [] }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['unit', unit.code],
    queryFn: () => api.get(`/units/${encodeURIComponent(unit.code)}`).then(r => r.data),
    enabled: expanded,
  })

  const unitAnomalies = anomalies.filter(a =>
    a.unit === unit.code || a.unit_name === unit.name
  )

  const fmt = (v) => Math.abs(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })

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
          <PlanBar
            label="Загрузка сырья (план/факт)"
            pct={unit.plan_pct_input || 0}
            fact={unit.fact_input_tons || 0}
            plan={unit.plan_input_tons || 0}
            fmt={fmt}
          />
          <PlanBar
            label="Выпуск продукции (план/факт)"
            pct={unit.plan_pct_output || 0}
            fact={unit.fact_output_tons || 0}
            plan={unit.plan_output_tons || 0}
            fmt={fmt}
          />
        </div>

        {/* Measured / Reconciled actuals */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-3" style={{ fontSize: '12px', color: '#94a3b8' }}>
          <div className="flex justify-between">
            <span>Сырьё (замер)</span>
            <span className="tabular-nums font-medium">{fmt(unit.input_measured || 0)} т</span>
          </div>
          <div className="flex justify-between">
            <span>Продукция (замер)</span>
            <span className="tabular-nums font-medium">{fmt(unit.output_measured || 0)} т</span>
          </div>
          <div className="flex justify-between">
            <span>Сырьё (согл)</span>
            <span className="tabular-nums font-medium">{fmt(unit.input_reconciled || 0)} т</span>
          </div>
          <div className="flex justify-between">
            <span>Продукция (согл)</span>
            <span className="tabular-nums font-medium">{fmt(unit.output_reconciled || 0)} т</span>
          </div>
        </div>

        {/* Delta measured vs reconciled */}
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

        {/* Stats text + anomaly link */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <span className={`flex items-center gap-1.5 ${unit.anomaly_count > 0 ? 'text-accent-yellow' : 'text-dark-muted'}`}>
            Обнаружено аномалий: <span className="font-semibold tabular-nums">{unit.anomaly_count}</span>
            {unit.anomaly_count > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/unit/${encodeURIComponent(unit.code)}`)
                }}
                className="ml-0.5 p-0.5 rounded hover:bg-white/10 transition-colors"
                title="Подробная аналитика"
              >
                <FileText size={14} />
              </button>
            )}
          </span>
          <span className={`${(unit.downtime_days || 0) > 0 ? 'text-accent-yellow' : 'text-dark-muted'}`}>
            Простоев: <span className="font-semibold tabular-nums">{unit.downtime_days || 0}</span> дн.
          </span>
        </div>

        {/* Expand toggle */}
        <div className="flex items-center gap-1 mt-4 text-xs text-dark-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{expanded ? 'Свернуть' : 'Развернуть аналитику'}</span>
        </div>
      </div>

      {/* Expanded: full-width analytics — everything in one sheet */}
      {expanded && (
        <div className="border-t border-dark-border bg-[#080e20] px-5 py-4 space-y-5">
          {detailLoading ? (
            <div className="text-sm text-dark-muted py-3">Загрузка аналитики...</div>
          ) : detail ? (
            <>
              <ProductsTable products={detail.products} />

              {detail.spc && detail.spc.dates?.length > 0 && (
                <ChartWrapper chartId="control" title="SPC Контрольная карта">
                  {(res) => <ControlChart spcData={detail.spc} resolved={res} />}
                </ChartWrapper>
              )}
              {detail.recon_gap && detail.recon_gap.dates?.length > 0 && (
                <ChartWrapper chartId="recon-gap" title="Расхождение прибор / согласованное (суммарное)">
                  {(res) => <ReconGapChart reconData={detail.recon_gap} resolved={res} />}
                </ChartWrapper>
              )}
              {detail.cusum && detail.cusum.dates?.length > 0 && (
                <ChartWrapper chartId="cusum" title="CUSUM">
                  {(res) => <CusumChart cusumData={detail.cusum} resolved={res} />}
                </ChartWrapper>
              )}

              {/* Heatmaps */}
              <ReconHeatmap
                unitCode={unit.code}
                direction="inputs"
                title="Расхождение замер/согл — Сырьё (входящие)"
              />
              <ReconHeatmap
                unitCode={unit.code}
                direction="outputs"
                title="Расхождение замер/согл — Продукция (исходящие)"
              />

              {unitAnomalies.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-dark-muted mb-2">
                    Аномалии ({unitAnomalies.length})
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {unitAnomalies.slice(0, 15).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                        <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                          a.severity === 'critical' ? 'bg-accent-red' : 'bg-accent-yellow'
                        }`} />
                        <span className="text-dark-muted shrink-0">{a.date?.slice(5)}</span>
                        <span className="text-dark-text">{a.description}</span>
                      </div>
                    ))}
                    {unitAnomalies.length > 15 && (
                      <div className="text-xs text-dark-muted">...и ещё {unitAnomalies.length - 15}</div>
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

function PlanBar({ label, pct, fact, plan, fmt }) {
  const barWidth = Math.min(100, pct)
  const color = pct >= 95 ? '#4ade80' : pct >= 80 ? '#fbbf24' : '#f87171'

  return (
    <div>
      <div className="text-xs text-dark-muted mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-6 bg-dark-border/50 rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold tabular-nums drop-shadow-sm">
            {fmt(fact)} из {fmt(plan)} т
          </span>
        </div>
        <span className="text-lg font-bold tabular-nums w-16 text-right" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
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
        {hasInputs && (
          <ProductTable
            title="Сырьё (вход)"
            titleColor="text-accent-blue"
            items={products.inputs}
            reconColor="text-accent-green"
          />
        )}
        {hasOutputs && (
          <ProductTable
            title="Продукция (выход)"
            titleColor="text-accent-green"
            items={products.outputs}
            reconColor="text-accent-blue"
          />
        )}
      </div>
    </div>
  )
}

function ProductTable({ title, titleColor, items, reconColor }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-3">
      <div className={`text-xs font-semibold ${titleColor} mb-2`}>
        {title} — {items.length} поз.
      </div>
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
                  <td className="py-1.5 pr-2 text-dark-text truncate max-w-[180px]" title={p.product}>
                    {p.product}
                  </td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-dark-muted">
                    {(p.share_pct != null ? p.share_pct : 0).toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-dark-muted">
                    {(p.measured || 0).toFixed(1)}
                  </td>
                  <td className={`py-1.5 px-1 text-right tabular-nums font-medium ${reconColor}`}>
                    {(p.reconciled || 0).toFixed(1)}
                  </td>
                  <td className={`py-1.5 px-1 text-right tabular-nums ${isHigh ? 'text-accent-red font-semibold' : 'text-dark-muted'}`}>
                    {devTons.toFixed(1)}
                  </td>
                  <td className={`py-1.5 pl-1 text-right tabular-nums ${isHigh ? 'text-accent-red font-semibold' : 'text-dark-muted'}`}>
                    {devPct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
