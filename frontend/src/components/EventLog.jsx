import StatusBadge from './StatusBadge'
import { fmtDate } from '../utils/excelExport'

const methodLabels = {
  balance_closure: 'Небаланс вход/выход',
  recon_gap: 'Расхождение измерено/согласовано',
  spc: 'Нетипичные дни',
  downtime: 'Простой',
  cross_unit: 'Потери продукции между установками',
}

export default function EventLog({ anomalies = [] }) {
  if (anomalies.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет аномалий</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-dark-muted">
            <th className="px-3 py-2 border border-dark-border/40">Дата</th>
            <th className="px-3 py-2 border border-dark-border/40">Установка</th>
            <th className="px-3 py-2 border border-dark-border/40">Метод</th>
            <th className="px-3 py-2 border border-dark-border/40">Описание</th>
            <th className="px-3 py-2 border border-dark-border/40 text-right">Значение</th>
            <th className="px-3 py-2 border border-dark-border/40 text-right">Порог</th>
            <th className="px-3 py-2 border border-dark-border/40">Уровень</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a, i) => (
            <tr key={i} className="hover:bg-white/5">
              <td className="px-3 py-2 border border-dark-border/20 whitespace-nowrap">{fmtDate(a.date)}</td>
              <td className="px-3 py-2 border border-dark-border/20 whitespace-nowrap">{a.unit_name || '—'}</td>
              <td className="px-3 py-2 border border-dark-border/20 whitespace-nowrap">{methodLabels[a.method] || a.method}</td>
              <td className="px-3 py-2 border border-dark-border/20 text-dark-muted max-w-xs truncate">{a.description}</td>
              <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums">{a.value}</td>
              <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums text-dark-muted">{a.threshold}</td>
              <td className="px-3 py-2 border border-dark-border/20">
                <StatusBadge status={a.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
