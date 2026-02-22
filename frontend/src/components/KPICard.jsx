export default function KPICard({ label, value, unit, trend, color = 'blue' }) {
  const colorMap = {
    blue: 'text-accent-blue',
    green: 'text-accent-green',
    red: 'text-accent-red',
    yellow: 'text-accent-yellow',
    purple: 'text-accent-purple',
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="text-xs text-dark-muted mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color] || 'text-dark-text'}`}>
        {typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : value}
        {unit && <span className="text-sm font-normal text-dark-muted ml-1">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  )
}
