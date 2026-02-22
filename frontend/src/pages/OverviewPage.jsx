import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import KPICard from '../components/KPICard'
import StatusBadge from '../components/StatusBadge'
import { ArrowRight } from 'lucide-react'

export default function OverviewPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  })

  if (isLoading) return <div className="text-dark-muted">Загрузка...</div>
  if (!data) return <div className="text-dark-muted">Нет данных. Загрузите файл .xlsm</div>

  const workshops = {}
  data.units.forEach(u => {
    const match = u.name.match(/Цех[а]?\s*[№#]?\s*(\d+)/i)
    const key = match ? `Цех ${match[1]}` : 'Прочее'
    if (!workshops[key]) workshops[key] = []
    workshops[key].push(u)
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <KPICard label="Вход сырья" value={data.total_in} unit="т" color="blue" />
        <KPICard label="Выход продукции" value={data.total_out} unit="т" color="green" />
        <KPICard label="Невязка" value={data.imbalance} unit="%" color={data.imbalance > 3 ? 'red' : 'yellow'} />
        <KPICard label="Аномалий" value={data.anomaly_count} color={data.anomaly_count > 0 ? 'red' : 'green'} />
        <KPICard label="Простои" value={data.downtime_count} color={data.downtime_count > 0 ? 'yellow' : 'green'} />
      </div>

      {Object.entries(workshops).map(([workshop, units]) => (
        <div key={workshop} className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark-text">{workshop}</h2>
            <span className="text-xs text-dark-muted">{units.length} установок</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-left text-dark-muted text-xs">
                  <th className="px-4 py-2">Установка</th>
                  <th className="px-3 py-2 text-right">Вход(изм)</th>
                  <th className="px-3 py-2 text-right">Вход(согл)</th>
                  <th className="px-3 py-2 text-right">Выход(согл)</th>
                  <th className="px-3 py-2 text-right">Невязка%</th>
                  <th className="px-3 py-2 text-right">Δпр/согл</th>
                  <th className="px-3 py-2 text-right">Аном.</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => (
                  <tr
                    key={u.code}
                    className="border-b border-dark-border/50 hover:bg-white/5 cursor-pointer"
                    onClick={() => navigate(`/unit/${encodeURIComponent(u.code)}`)}
                  >
                    <td className="px-4 py-2.5 font-medium text-dark-text max-w-xs truncate">{u.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{u.input_measured.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{u.input_reconciled.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{u.output_reconciled.toFixed(1)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Math.abs(u.imbalance_pct) > 3 ? 'text-accent-red' : ''}`}>
                      {u.imbalance_pct.toFixed(2)}%
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${u.recon_gap_pct > 5 ? 'text-accent-red' : ''}`}>
                      {u.recon_gap_pct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {u.anomaly_count > 0 ? (
                        <span className="text-accent-red font-semibold">{u.anomaly_count}</span>
                      ) : (
                        <span className="text-dark-muted">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={u.status} /></td>
                    <td className="px-3 py-2.5"><ArrowRight size={14} className="text-dark-muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
