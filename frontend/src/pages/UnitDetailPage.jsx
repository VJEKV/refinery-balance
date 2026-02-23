import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import KPICard from '../components/KPICard'
import ControlChart from '../components/ControlChart'
import ReconGapChart from '../components/ReconGapChart'
import CusumChart from '../components/CusumChart'
import EventLog from '../components/EventLog'
import { ArrowLeft } from 'lucide-react'

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
        <KPICard label="Невязка" value={kpi.imbalance_pct} unit="%" color={Math.abs(kpi.imbalance_pct) > 3 ? 'red' : 'yellow'} />
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
          <ControlChart spcData={spc} />
          <ReconGapChart reconData={recon_gap} />
          <CusumChart cusumData={cusum} />
        </div>
      )}

      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 text-dark-text">Входящие</h3>
            <div className="space-y-2">
              {products.inputs.map((p, i) => {
                const maxVal = Math.max(...products.inputs.map(x => x.measured || 0), 1)
                const pct = (p.measured / maxVal) * 100
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-dark-text truncate max-w-[200px]">{p.product}</span>
                      <span className="font-mono text-dark-muted">{p.measured.toFixed(1)} т</span>
                    </div>
                    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent-blue rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {products.inputs.length === 0 && <div className="text-xs text-dark-muted">Нет данных</div>}
            </div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 text-dark-text">Исходящие</h3>
            <div className="space-y-2">
              {products.outputs.map((p, i) => {
                const maxVal = Math.max(...products.outputs.map(x => x.measured || 0), 1)
                const pct = (p.measured / maxVal) * 100
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-dark-text truncate max-w-[200px]">{p.product}</span>
                      <span className="font-mono text-dark-muted">{p.measured.toFixed(1)} т</span>
                    </div>
                    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {products.outputs.length === 0 && <div className="text-xs text-dark-muted">Нет данных</div>}
            </div>
          </div>
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
