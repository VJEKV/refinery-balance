import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import KPICard from '../components/KPICard'
import UnitCard from '../components/UnitCard'
import { useDateFilter } from '../hooks/useDateFilter'

export default function OverviewPage() {
  const { dateParams } = useDateFilter()

  const { data, isLoading } = useQuery({
    queryKey: ['overview', dateParams],
    queryFn: () => api.get('/analytics/overview', { params: dateParams }).then(r => r.data),
  })

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', dateParams],
    queryFn: () => api.get('/anomalies', { params: dateParams }).then(r => r.data),
  })

  if (isLoading) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Нет данных. Загрузите файл .xlsm</div>

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Суммарный вход (согл)" value={data.total_in} unit="т" color="blue" />
        <KPICard label="Суммарный выход (согл)" value={data.total_out} unit="т" color="green" />
        <KPICard label="Средняя невязка" value={data.imbalance} unit="%" color={data.imbalance > 3 ? 'red' : 'yellow'} />
        <KPICard label="Всего аномалий" value={data.anomaly_count} color={data.anomaly_count > 0 ? 'red' : 'green'} />
        <KPICard label="Простои (уст-дни)" value={data.downtime_count} color={data.downtime_count > 0 ? 'yellow' : 'green'} />
      </div>

      {/* Units grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {data.units.map(u => (
          <UnitCard key={u.code} unit={u} anomalies={anomalies || []} />
        ))}
      </div>
    </div>
  )
}
