import { NavLink } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3, AlertTriangle, GitBranch, FolderOpen, HelpCircle,
  ChevronDown, ChevronUp, Save, RotateCcw, Calendar, X,
} from 'lucide-react'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'

const navItems = [
  { to: '/', icon: BarChart3, label: 'Обзор' },
  { to: '/sankey', icon: GitBranch, label: 'Потоки' },
  { to: '/upload', icon: FolderOpen, label: 'Загрузка' },
  { to: '/help', icon: HelpCircle, label: 'Справка' },
]

const methodConfig = [
  {
    key: 'balance_closure', label: 'Небаланс вход/выход', unit: '%', min: 0.5, max: 10, step: 0.5,
    color: '#f87171',
    desc: 'Разница между тем, что поступило на установку, и тем, что вышло. Если разница больше порога — возможны потери продукции, ошибки приборов или неучтённые сбросы.',
  },
  {
    key: 'recon_gap', label: 'Расхождение измерено/согласовано', unit: '%', min: 1, max: 20, step: 0.5,
    color: '#f59e0b',
    desc: 'Приборы показали одно значение, а в согласованном балансе стоит другое. Чем больше разница — тем менее достоверны данные. Причины: неточные приборы, ручные корректировки, ошибки ввода.',
  },
  {
    key: 'spc_sigma', label: 'Нетипичные дни', unit: 'σ', min: 1, max: 5, step: 0.5,
    color: '#3b82f6',
    desc: 'Дни, когда загрузка установки резко отличалась от обычного уровня. Порог задаёт допустимое количество отклонений от среднего. Возможны сбои оборудования, ошибки данных или нештатные режимы работы.',
  },
  {
    key: 'downtime_pct', label: 'Простой', unit: '%', min: 1, max: 50, step: 1,
    color: '#64748b',
    desc: 'Загрузка установки ниже порога от среднего уровня — установка не работала или работала на минимуме. Порог задаёт, при каком проценте от обычной загрузки день считается простоем.',
  },
  {
    key: 'cross_unit', label: 'Потери продукции между установками', unit: '%', min: 1, max: 20, step: 0.5,
    color: '#22d3ee',
    desc: 'Одна установка отдала продукт, а следующая получила меньше. Разница может означать потери при передаче, ошибки учёта или утечки на соединительных трубопроводах.',
  },
]

export default function Sidebar({ fileCount = 0, unitCount = 0, dateRange = '', availableMonths = [] }) {
  const queryClient = useQueryClient()
  const { selectedMonth, selectMonth, selectAll, dateFrom, dateTo, setDateFrom, setDateTo, MONTH_NAMES } = useDateFilter()

  const [values, setValues] = useState({})
  const [expandedMethod, setExpandedMethod] = useState(null)
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const { data: thresholds } = useQuery({
    queryKey: ['thresholds'],
    queryFn: () => api.get('/settings/thresholds').then(r => r.data),
  })

  useEffect(() => {
    if (thresholds) setValues(thresholds)
  }, [thresholds])

  // Close month dropdown on outside click
  useEffect(() => {
    if (!monthDropdownOpen) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMonthDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [monthDropdownOpen])

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

  const selectedMonthLabel = selectedMonth !== null ? MONTH_NAMES[selectedMonth] : null

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

      {/* Date filter — dropdown + tags */}
      <div className="px-3 pb-3 border-b border-dark-border">
        <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-2 px-1">
          Период
        </div>

        {/* Month dropdown */}
        <div className="relative mb-2" ref={dropdownRef}>
          <button
            onClick={() => setMonthDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-text hover:border-dark-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-dark-muted" />
              <span>{selectedMonthLabel || 'Все месяцы'}</span>
            </div>
            <ChevronDown size={14} className={`text-dark-muted transition-transform ${monthDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {monthDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-2 max-h-60 overflow-y-auto">
              <button
                onClick={() => { selectAll(); setMonthDropdownOpen(false) }}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-colors ${
                  selectedMonth === null && !dateFrom
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
                }`}
              >
                Все месяцы
              </button>
              {MONTH_NAMES.map((m, i) => {
                const hasData = availableMonths.includes(i + 1)
                return (
                  <button
                    key={i}
                    onClick={() => { if (hasData) { selectMonth(i); setMonthDropdownOpen(false) } }}
                    disabled={!hasData}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-colors ${
                      selectedMonth === i
                        ? 'bg-accent-blue/15 text-accent-blue'
                        : hasData
                          ? 'text-dark-muted hover:text-dark-text hover:bg-white/5'
                          : 'text-dark-muted/30 cursor-not-allowed'
                    }`}
                  >
                    {m}{!hasData && ' (нет данных)'}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected month tag */}
        {selectedMonthLabel && (
          <div className="flex gap-1 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-blue/15 text-accent-blue rounded text-xs">
              {selectedMonthLabel}
              <button
                onClick={() => selectAll()}
                className="hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        )}

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

      {/* Methods & Thresholds — colored per method */}
      <div className="px-3 py-3 border-b border-dark-border">
        <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-2 px-1">
          Методы и пороги
        </div>
        <div className="space-y-2">
          {methodConfig.map(cfg => {
            const isExpanded = expandedMethod === cfg.key
            return (
              <div
                key={cfg.key}
                className="bg-dark-card border rounded-lg p-2"
                style={{ borderColor: `${cfg.color}33` }}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedMethod(isExpanded ? null : cfg.key)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                    <span className="text-xs text-dark-text truncate">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs tabular-nums" style={{ color: cfg.color }}>
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
                  className="w-full h-1 rounded appearance-none cursor-pointer mt-1.5"
                  style={{
                    '--slider-color': cfg.color,
                  }}
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
        <div className="text-[10px] text-dark-muted/50 pt-1">v1.2.3</div>
      </div>
    </aside>
  )
}
