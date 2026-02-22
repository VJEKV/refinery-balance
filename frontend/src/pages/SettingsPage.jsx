import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../api/client'
import { Save, RotateCcw } from 'lucide-react'

const sliderConfig = [
  { key: 'balance_closure', label: 'Невязка МБ', unit: '%', min: 0.5, max: 10, step: 0.5, icon: '\u2696\uFE0F' },
  { key: 'recon_gap', label: 'Прибор vs Согласов.', unit: '%', min: 1, max: 20, step: 0.5, icon: '\uD83D\uDCD0' },
  { key: 'spc_sigma', label: 'SPC', unit: '\u03C3', min: 1, max: 5, step: 0.5, icon: '\uD83D\uDCCA' },
  { key: 'cusum_drift', label: 'CUSUM дрейф', unit: '%', min: 1, max: 20, step: 0.5, icon: '\uD83D\uDCC8' },
  { key: 'downtime_pct', label: 'Простой', unit: '%', min: 1, max: 50, step: 1, icon: '\u23F8\uFE0F' },
  { key: 'cross_unit', label: 'Межцеховой баланс', unit: '%', min: 1, max: 20, step: 0.5, icon: '\uD83D\uDD17' },
]

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState({})

  const { data: thresholds } = useQuery({
    queryKey: ['thresholds'],
    queryFn: () => api.get('/settings/thresholds').then(r => r.data),
  })

  useEffect(() => {
    if (thresholds) setValues(thresholds)
  }, [thresholds])

  const saveMutation = useMutation({
    mutationFn: (vals) => api.put('/settings/thresholds', vals),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
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
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-dark-text">Настройки порогов</h1>

      <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-6">
        {sliderConfig.map(({ key, label, unit, min, max, step, icon }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-dark-text">
                <span className="mr-2">{icon}</span>
                {label}
              </label>
              <span className="text-sm font-mono text-accent-blue">
                {(values[key] ?? 0).toFixed(1)}{unit}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key] ?? 0}
              onChange={e => handleChange(key, e.target.value)}
              className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-accent-blue"
            />
            <div className="flex justify-between text-xs text-dark-muted mt-1">
              <span>{min}{unit}</span>
              <span>{max}{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-dark-text mb-2">Рекомендации</h3>
        <ul className="text-xs text-dark-muted space-y-1">
          <li>Невязка МБ: 2-5% типично для НПЗ</li>
          <li>Прибор/согласованное: 3-10% в зависимости от точности приборов</li>
          <li>SPC: 3 сигмы — стандартное правило Шухарта</li>
          <li>CUSUM: 5% дрейфа — чувствительный порог</li>
          <li>Простой: менее 10% от среднего — считается простоем</li>
          <li>Межцеховой: 3-5% потерь на трассах допустимо</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => saveMutation.mutate(values)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 disabled:opacity-50"
        >
          <Save size={16} />
          {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border text-dark-text rounded-lg text-sm hover:bg-white/5"
        >
          <RotateCcw size={16} />
          Сбросить
        </button>
        {saveMutation.isSuccess && (
          <span className="text-sm text-accent-green self-center">Сохранено</span>
        )}
      </div>
    </div>
  )
}
