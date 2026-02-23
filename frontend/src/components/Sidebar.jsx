import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3, AlertTriangle, GitBranch, FolderOpen,
  ChevronDown, ChevronUp, Save, RotateCcw,
} from 'lucide-react'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'

const navItems = [
  { to: '/', icon: BarChart3, label: 'Обзор' },
  { to: '/anomalies', icon: AlertTriangle, label: 'Аномалии' },
  { to: '/sankey', icon: GitBranch, label: 'Потоки' },
  { to: '/upload', icon: FolderOpen, label: 'Загрузка' },
]

const methodConfig = [
  {
    key: 'balance_closure', label: 'Невязка МБ', unit: '%', min: 0.5, max: 10, step: 0.5, icon: '\u2696\uFE0F',
    desc: 'Дебаланс между измеренным входом и выходом установки. Показывает реальные потери, утечки, некалиброванные приборы.',
  },
  {
    key: 'recon_gap', label: 'Прибор vs Согласов.', unit: '%', min: 1, max: 20, step: 0.5, icon: '\uD83D\uDCD0',
    desc: 'Расхождение между показаниями приборов и значениями после согласования. Выявляет ручные корректировки и дрейф датчиков.',
  },
  {
    key: 'spc_sigma', label: 'SPC Контрольные карты', unit: '\u03C3', min: 1, max: 5, step: 0.5, icon: '\uD83D\uDCCA',
    desc: 'Статистический контроль: если суточный объём выходит за \u00B13\u03C3 от среднего — аномальный день. Ловит разовые выбросы.',
  },
  {
    key: 'cusum_drift', label: 'CUSUM Дрейф', unit: '%', min: 1, max: 20, step: 0.5, icon: '\uD83D\uDCC8',
    desc: 'Кумулятивная сумма отклонений. Ловит медленный дрейф: когда установка 10 дней подряд чуть недовырабатывает — SPC молчит, а CUSUM сработает.',
  },
  {
    key: 'downtime_pct', label: 'Простой', unit: '%', min: 1, max: 50, step: 1, icon: '\u23F8\uFE0F',
    desc: 'Загрузка установки ниже порога от среднего = простой. Отделяет остановку от аномалии.',
  },
  {
    key: 'cross_unit', label: 'Межцеховой баланс', unit: '%', min: 1, max: 20, step: 0.5, icon: '\uD83D\uDD17',
    desc: 'Потери при передаче продукта между установками. Выход одной \u2260 вход другой = утечка или некалиброванный прибор на трассе.',
  },
]

export default function Sidebar({ fileCount = 0, unitCount = 0, dateRange = '' }) {
  const queryClient = useQueryClient()
  const { selectedMonth, selectMonth, selectAll, dateFrom, dateTo, setDateFrom, setDateTo, MONTH_NAMES } = useDateFilter()

  const [values, setValues] = useState({})
  const [expandedMethod, setExpandedMethod] = useState(null)

  const { data: thresholds } = useQuery({
    queryKey: ['thresholds'],
    queryFn: () => api.get('/settings/thresholds').then(r => r.data),
  })

  useEffect(() => {
    if (thresholds) setValues(thresholds)
  }, [thresholds])

  const saveMutation = useMutation({
    mutationFn: (vals) => api.put('/settings/thresholds', vals),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const resetMutation = useMutation({
    mutationFn: () => api.post('/settings/thresholds/reset'),
    onSuccess: (res) => {
      setValues(res.data)
      queryClient.invalidateQueries()
    },
  })

  const handleChange = (key, val) => {
    setValues(v => ({ ...v, [key]: parseFloat(val) }))
  }

  return (
    <aside className="w-[280px] bg-[#080e20] border-r border-dark-border flex flex-col shrink-0 overflow-y-auto overflow-x-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-dark-border flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-accent-blue flex items-center justify-center text-white font-bold text-sm shrink-0">
          МБ
        </div>
        <span className="text-sm font-semibold text-dark-text">МБ Аналитика</span>
      </div>

      {/* Navigation */}
      <div className="p-3">
        <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-2 px-1">
          Навигация
        </div>
        <nav className="space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Date filter */}
      <div className="px-3 pb-3 border-b border-dark-border">
        <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-2 px-1">
          Период
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={selectAll}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              selectedMonth === null && !dateFrom
                ? 'bg-accent-blue text-white'
                : 'bg-dark-card text-dark-muted hover:text-dark-text border border-dark-border'
            }`}
          >
            Все
          </button>
          {MONTH_NAMES.map((m, i) => (
            <button
              key={i}
              onClick={() => selectMonth(i)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                selectedMonth === i
                  ? 'bg-accent-blue text-white'
                  : 'bg-dark-card text-dark-muted hover:text-dark-text border border-dark-border'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="flex-1 bg-dark-card border border-dark-border rounded px-1.5 py-1 text-xs text-dark-text w-0"
          />
          <span className="text-dark-muted text-xs">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="flex-1 bg-dark-card border border-dark-border rounded px-1.5 py-1 text-xs text-dark-text w-0"
          />
        </div>
      </div>

      {/* Methods & Thresholds */}
      <div className="px-3 py-3 border-b border-dark-border">
        <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-2 px-1">
          Методы и пороги
        </div>
        <div className="space-y-2">
          {methodConfig.map(cfg => {
            const isExpanded = expandedMethod === cfg.key
            return (
              <div key={cfg.key} className="bg-dark-card border border-dark-border rounded-lg p-2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedMethod(isExpanded ? null : cfg.key)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs">{cfg.icon}</span>
                    <span className="text-xs text-dark-text truncate">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-mono text-accent-blue">
                      {(values[cfg.key] ?? 0).toFixed(1)}{cfg.unit}
                    </span>
                    {isExpanded ? <ChevronUp size={12} className="text-dark-muted" /> : <ChevronDown size={12} className="text-dark-muted" />}
                  </div>
                </div>
                {isExpanded && (
                  <p className="text-[0.65rem] text-dark-muted mt-1.5 leading-relaxed">
                    {cfg.desc}
                  </p>
                )}
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={values[cfg.key] ?? 0}
                  onChange={e => handleChange(cfg.key, e.target.value)}
                  className="w-full h-1 bg-dark-border rounded appearance-none cursor-pointer accent-accent-blue mt-1.5"
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => saveMutation.mutate(values)}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent-blue text-white rounded text-xs font-medium hover:bg-accent-blue/80 disabled:opacity-50"
          >
            <Save size={12} />
            {saveMutation.isPending ? '...' : 'Сохранить'}
          </button>
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-dark-card border border-dark-border text-dark-text rounded text-xs hover:bg-white/5"
          >
            <RotateCcw size={12} />
            Сброс
          </button>
          {saveMutation.isSuccess && (
            <span className="text-[0.65rem] text-accent-green self-center">OK</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 mt-auto space-y-1">
        <div className="text-xs text-dark-muted">Файлов: {fileCount}</div>
        <div className="text-xs text-dark-muted">Установок: {unitCount}</div>
        {dateRange && <div className="text-xs text-dark-muted">Период: {dateRange}</div>}
      </div>
    </aside>
  )
}
