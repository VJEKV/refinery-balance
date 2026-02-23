import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, ArrowRight, Factory } from 'lucide-react'
import StatusBadge from './StatusBadge'
import DonutChart from './DonutChart'

export default function UnitCard({ unit, anomalies = [] }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const unitAnomalies = anomalies.filter(a =>
    a.unit === unit.code || a.unit_name === unit.name
  )

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-dark-muted/50 transition-colors">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Factory size={16} className="text-accent-blue shrink-0" />
            <h3 className="text-sm font-semibold text-dark-text truncate">{unit.name}</h3>
          </div>
          <StatusBadge status={unit.status} />
        </div>

        {/* Body: donut + metrics */}
        <div className="flex items-center gap-4">
          <DonutChart
            measured={Math.abs(unit.input_measured)}
            reconciled={Math.abs(unit.input_reconciled)}
            deviation={Math.abs(unit.imbalance_pct)}
            size={100}
          />
          <div className="flex-1 space-y-1.5 min-w-0">
            <MetricRow
              label="Производительность"
              value={`${unit.input_reconciled.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} т`}
            />
            <MetricRow
              label="Невязка"
              value={`${unit.imbalance_pct.toFixed(2)}% (${unit.imbalance >= 0 ? '+' : ''}${unit.imbalance.toFixed(0)} т)`}
              warn={Math.abs(unit.imbalance_pct) > 3}
            />
            <MetricRow
              label="Аномалий"
              value={unit.anomaly_count}
              warn={unit.anomaly_count > 0}
            />
            <MetricRow
              label="Простои"
              value={`${unit.is_downtime ? '1' : '0'} дн`}
              warn={unit.is_downtime}
            />
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex items-center gap-1 mt-3 text-xs text-dark-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{expanded ? 'Свернуть' : 'Развернуть аномалии'}</span>
        </div>
      </div>

      {/* Accordion */}
      {expanded && (
        <div className="border-t border-dark-border bg-[#080e20] px-4 py-3">
          <div className="text-xs font-medium text-dark-muted mb-2">
            Аномалии установки «{unit.name}»
          </div>
          {unitAnomalies.length === 0 ? (
            <div className="text-xs text-dark-muted py-1">Аномалий не обнаружено</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {unitAnomalies.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                  <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                    a.severity === 'critical' ? 'bg-accent-red' : 'bg-accent-yellow'
                  }`} />
                  <span className="text-dark-muted shrink-0">{a.date?.slice(5)}</span>
                  <span className="text-dark-text truncate">{a.description}</span>
                </div>
              ))}
              {unitAnomalies.length > 10 && (
                <div className="text-xs text-dark-muted">...и ещё {unitAnomalies.length - 10}</div>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/unit/${encodeURIComponent(unit.code)}`)
            }}
            className="flex items-center gap-1 mt-2 text-xs text-accent-blue hover:underline"
          >
            Подробная аналитика <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value, warn = false }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-dark-muted">{label}</span>
      <span className={`font-mono ${warn ? 'text-accent-red' : 'text-dark-text'}`}>{value}</span>
    </div>
  )
}
