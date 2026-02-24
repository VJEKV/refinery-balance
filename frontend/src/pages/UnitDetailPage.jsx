import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import KPICard from '../components/KPICard'
import ControlChart from '../components/ControlChart'
import ReconGapChart from '../components/ReconGapChart'
import CusumChart from '../components/CusumChart'
import EventLog from '../components/EventLog'
import ChartWrapper from '../components/ChartWrapper'
import ReconHeatmap from '../components/ReconHeatmap'
import { ArrowLeft, ChevronDown } from 'lucide-react'

const INPUT_COLORS = ['#3b82f6','#6366f1','#8b5cf6','#06b6d4','#0ea5e9','#2563eb','#7c3aed','#0891b2','#4f46e5','#0284c7','#6d28d9','#0369a1','#4338ca','#155e75','#5b21b6']
const OUTPUT_COLORS = ['#22c55e','#10b981','#14b8a6','#84cc16','#34d399','#059669','#a3e635','#0d9488','#16a34a','#65a30d','#047857','#4ade80','#15803d','#0f766e','#166534']

export default function UnitDetailPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('charts')

  const { data, isLoading } = useQuery({
    queryKey: ['unit', code],
    queryFn: () => api.get(`/units/${encodeURIComponent(code)}`).then(r => r.data),
  })

  if (isLoading) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Установка не найдена</div>

  const { kpi, spc, cusum, recon_gap, products, anomalies } = data

  const tabs = [
    { id: 'charts', label: 'Графики' },
    { id: 'recon', label: 'Расхождение' },
    { id: 'products', label: 'Продукты' },
    { id: 'events', label: 'События' },
  ]

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-dark-muted hover:text-dark-text"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-dark-text">{data.name}</h1>
          <p className="text-xs text-dark-muted mt-0.5">
            Период: {data.dates[0]} — {data.dates[data.dates.length - 1]}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Вход (изм)" value={kpi.input_measured} unit="т" color="blue" />
        <KPICard label="Вход (согл)" value={kpi.input_reconciled} unit="т" color="blue" />
        <KPICard label="Выход (согл)" value={kpi.output_reconciled} unit="т" color="green" />
        <KPICard label="Отклонение" value={kpi.imbalance_pct} unit="%" color={Math.abs(kpi.imbalance_pct) > 3 ? 'red' : 'yellow'} />
        <KPICard label="Δ пр/согл" value={kpi.recon_gap_pct} unit="%" color={kpi.recon_gap_pct > 5 ? 'red' : 'yellow'} />
        <KPICard label="Аномалий" value={kpi.anomaly_count} color={kpi.anomaly_count > 0 ? 'red' : 'green'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dark-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-dark-muted hover:text-dark-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'charts' && (
        <div className="space-y-4">
          <ChartWrapper chartId="control" title="SPC Контрольная карта">
            {(resolved) => <ControlChart spcData={spc} resolved={resolved} />}
          </ChartWrapper>
          <ChartWrapper chartId="recon-gap" title="Расхождение прибор / согласованное">
            {(resolved) => <ReconGapChart reconData={recon_gap} resolved={resolved} />}
          </ChartWrapper>
          <ChartWrapper chartId="cusum" title="CUSUM">
            {(resolved) => <CusumChart cusumData={cusum} resolved={resolved} />}
          </ChartWrapper>
        </div>
      )}

      {tab === 'recon' && (
        <div className="space-y-4">
          <ReconHeatmap
            unitCode={code}
            direction="inputs"
            title="Расхождение замер/согл — Сырьё (входящие)"
          />
          <ReconHeatmap
            unitCode={code}
            direction="outputs"
            title="Расхождение замер/согл — Продукция (исходящие)"
          />
        </div>
      )}

      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProductBasket
            title="Структура сырья (входящие)"
            items={products.inputs}
            palette={INPUT_COLORS}
          />
          <ProductBasket
            title="Структура продукции (исходящие)"
            items={products.outputs}
            palette={OUTPUT_COLORS}
          />
        </div>
      )}

      {tab === 'events' && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <EventLog anomalies={anomalies.map(a => ({ ...a, unit_name: data.name }))} />
        </div>
      )}
    </div>
  )
}

function ProductBasket({ title, items, palette }) {
  const [showAll, setShowAll] = useState(false)

  if (!items || items.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-dark-text mb-3">{title}</h3>
        <div className="text-xs text-dark-muted">Нет данных</div>
      </div>
    )
  }

  const active = items.filter(p => p.measured > 0 || p.reconciled > 0)
  const zero = items.filter(p => p.measured === 0 && p.reconciled === 0)
  const visible = showAll ? items : active

  const fmt = (v) => Math.abs(v).toLocaleString('ru-RU', { maximumFractionDigits: 1 })

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-dark-text mb-4">{title}</h3>
      <div className="space-y-3">
        {visible.map((p, i) => {
          const color = palette[i % palette.length]
          const delta = p.delta_tons || 0
          const deltaPct = p.delta_pct || 0
          const isZero = p.measured === 0 && p.reconciled === 0
          const deltaColor = delta === 0 ? '#64748b' : delta < 0 ? '#f87171' : '#f59e0b'
          const sign = (v) => v > 0 ? '+' : v < 0 ? '\u2212' : ''

          return (
            <div key={i} className={isZero ? 'opacity-40' : ''}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-dark-text truncate flex-1" title={p.product}>{p.product}</span>
                <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>
                  {(p.share_pct || 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-5 bg-dark-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(p.share_pct || 0, 0.5)}%`, backgroundColor: color }}
                />
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] tabular-nums">
                <span className="text-dark-muted">{fmt(p.measured)} т замер</span>
                <span className="text-dark-muted">{fmt(p.reconciled)} т согл</span>
                <span className="font-medium" style={{ color: deltaColor }}>
                  {sign(delta)}{fmt(delta)} т ({sign(deltaPct)}{Math.abs(deltaPct).toFixed(1)}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {zero.length > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1 mt-3 text-xs text-dark-muted hover:text-dark-text transition-colors"
        >
          <ChevronDown size={12} />
          Показать все ({zero.length} нулевых)
        </button>
      )}
    </div>
  )
}
