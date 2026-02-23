import StatusBadge from './StatusBadge'

const methodLabels = {
  balance_closure: 'Потери и утечки',
  recon_gap: 'Прибор/Согласов.',
  spc: 'SPC',
  cusum: 'CUSUM',
  downtime: 'Простой',
  cross_unit: 'Межцеховой',
}

export default function EventLog({ anomalies = [] }) {
  if (anomalies.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет аномалий</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-border text-left text-dark-muted">
            <th className="px-3 py-2">Дата</th>
            <th className="px-3 py-2">Установка</th>
            <th className="px-3 py-2">Метод</th>
            <th className="px-3 py-2">Описание</th>
            <th className="px-3 py-2 text-right">Значение</th>
            <th className="px-3 py-2 text-right">Порог</th>
            <th className="px-3 py-2">Уровень</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a, i) => (
            <tr key={i} className="border-b border-dark-border/50 hover:bg-white/5">
              <td className="px-3 py-2 whitespace-nowrap">{a.date}</td>
              <td className="px-3 py-2 whitespace-nowrap">{a.unit_name || '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{methodLabels[a.method] || a.method}</td>
              <td className="px-3 py-2 text-dark-muted max-w-xs truncate">{a.description}</td>
              <td className="px-3 py-2 text-right tabular-nums">{a.value}</td>
              <td className="px-3 py-2 text-right tabular-nums text-dark-muted">{a.threshold}</td>
              <td className="px-3 py-2">
                <StatusBadge status={a.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
