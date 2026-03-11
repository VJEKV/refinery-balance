import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import KPICard from '../components/KPICard'
import ControlChart from '../components/ControlChart'
import ReconGapChart from '../components/ReconGapChart'
import CusumChart from '../components/CusumChart'
import ChartWrapper from '../components/ChartWrapper'
import ReconHeatmap from '../components/ReconHeatmap'
import { ArrowLeft } from 'lucide-react'
import { useDateFilter } from '../hooks/useDateFilter'

export default function UnitDetailPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { dateParams } = useDateFilter()

  const { data, isLoading } = useQuery({
    queryKey: ['unit', code, dateParams],
    queryFn: () => api.get(`/units/${encodeURIComponent(code)}`, { params: dateParams }).then(r => r.data),
  })

  if (isLoading) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Установка не найдена</div>

  const { kpi, spc, cusum, recon_gap } = data

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* 1. KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Вход (изм)" value={kpi.input_measured} unit="т" color="blue" />
        <KPICard label="Вход (согл)" value={kpi.input_reconciled} unit="т" color="blue" />
        <KPICard label="Выход (согл)" value={kpi.output_reconciled} unit="т" color="green" />
        <KPICard label="Отклонение" value={kpi.imbalance_pct} unit="%" color={Math.abs(kpi.imbalance_pct) > 3 ? 'red' : 'yellow'} />
        <KPICard label="Δ пр/согл" value={kpi.recon_gap_pct} unit="%" color={kpi.recon_gap_pct > 5 ? 'red' : 'yellow'} />
        <KPICard label="Аномалий" value={kpi.anomaly_count} color={kpi.anomaly_count > 0 ? 'red' : 'green'} />
      </div>

      {/* 2. SPC + CUSUM */}
      <ChartWrapper chartId="control" title="SPC Контрольная карта">
        {(resolved) => <ControlChart spcData={spc} resolved={resolved} />}
      </ChartWrapper>
      <ChartWrapper chartId="cusum" title="CUSUM">
        {(resolved) => <CusumChart cusumData={cusum} resolved={resolved} />}
      </ChartWrapper>

      {/* 3. Расхождение прибор/согл — бар-чарт по дням */}
      <ChartWrapper chartId="recon-gap" title="Расхождение прибор / согласованное">
        {(resolved) => <ReconGapChart reconData={recon_gap} resolved={resolved} />}
      </ChartWrapper>

      {/* 4. Тепловая карта — Сырьё */}
      <ReconHeatmap
        unitCode={code}
        direction="inputs"
        title="Расхождение замер/согл — Сырьё (входящие)"
        dateParams={dateParams}
      />

      {/* 5. Тепловая карта — Продукция */}
      <ReconHeatmap
        unitCode={code}
        direction="outputs"
        title="Расхождение замер/согл — Продукция (исходящие)"
        dateParams={dateParams}
      />
    </div>
  )
}
