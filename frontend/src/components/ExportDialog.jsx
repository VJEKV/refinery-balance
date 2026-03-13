import { useState, useMemo } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '../api/client'

export default function ExportDialog({ isOpen, onClose, method, methodLabel, methodColor, anomalies = [] }) {
  const [severity, setSeverity] = useState('all')
  const [includeProducts, setIncludeProducts] = useState(false)
  const [exporting, setExporting] = useState(false)

  const criticalCount = useMemo(() => anomalies.filter(a => a.severity === 'critical').length, [anomalies])
  const warnCount = useMemo(() => anomalies.filter(a => a.severity === 'warn').length, [anomalies])

  const filtered = useMemo(() => {
    if (severity === 'all') return anomalies
    return anomalies.filter(a => a.severity === severity)
  }, [anomalies, severity])

  const handleExport = async () => {
    if (filtered.length === 0) return
    setExporting(true)
    try {
      await doExport(filtered, method, methodLabel, includeProducts)
    } catch (e) {
      console.error('Export error:', e)
    }
    setExporting(false)
    onClose()
  }

  if (!isOpen) return null

  const radios = [
    { value: 'all', label: `Все (${anomalies.length})` },
    { value: 'critical', label: `Критично (${criticalCount})` },
    { value: 'warn', label: `Внимание (${warnCount})` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-dark-card border rounded-xl p-6 w-[400px] max-w-[90vw]"
        style={{
          borderColor: `${methodColor}60`,
          boxShadow: `0 0 20px ${methodColor}30, 0 0 40px ${methodColor}15`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-dark-text">Выгрузка в Excel</h3>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="text-sm font-medium text-slate-300 mb-1" style={{ color: methodColor }}>
          {methodLabel}
        </div>

        <div className="mb-4 mt-3">
          <div className="text-sm text-slate-300 mb-2">Уровень аномалий:</div>
          <div className="space-y-1.5">
            {radios.map(r => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm text-dark-text hover:bg-white/5 px-2 py-1.5 rounded-lg transition-colors">
                <input
                  type="radio"
                  name="severity"
                  value={r.value}
                  checked={severity === r.value}
                  onChange={() => setSeverity(r.value)}
                  className="accent-blue-500"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-dark-text hover:bg-white/5 px-2 py-1.5 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={includeProducts}
              onChange={e => setIncludeProducts(e.target.checked)}
              className="accent-blue-500"
            />
            Включить продукты (уровень 3)
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-dark-muted border border-dark-border rounded-lg hover:bg-white/5 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-accent-blue rounded-lg hover:bg-accent-blue/80 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Выгрузка...' : `Выгрузить (${filtered.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

async function fetchProductDetails(unitCode, date) {
  try {
    const resp = await api.get('/anomalies/product-details', { params: { unit: unitCode, date } })
    return resp.data
  } catch {
    return { inputs: [], outputs: [] }
  }
}

async function doExport(anomalies, method, methodLabel, includeProducts) {
  const sev = a => a.severity === 'critical' ? 'Критично' : 'Внимание'
  const isBalance = method === 'balance_closure'
  const isRecon = method === 'recon_gap'
  const isSpc = method === 'spc'
  const isCross = method === 'cross_unit'

  // Fetch product details if needed
  let productCache = {}
  if (includeProducts && (isBalance || isRecon || isSpc)) {
    const keys = new Set()
    anomalies.forEach(a => keys.add(`${a.unit}__${a.date}`))
    for (const key of keys) {
      const [unit, date] = key.split('__')
      productCache[key] = await fetchProductDetails(unit, date)
    }
  }

  const rows = []
  const rowOutlines = []

  for (const a of anomalies) {
    // Level 2 row
    let row
    if (isBalance) {
      row = {
        'Дата': a.date, 'Установка': a.unit_name || '',
        'Вход сырья изм (т)': a.input_measured, 'Выход продукции изм (т)': a.output_measured,
        'Небаланс (т)': a.delta_tons, 'Небаланс (%)': a.delta_pct, 'Уровень': sev(a),
      }
    } else if (isRecon) {
      row = {
        'Дата': a.date, 'Установка': a.unit_name || '',
        'Сырьё изм (т)': a.input_measured, 'Сырьё согл (т)': a.input_reconciled,
        'Δ сырьё (т)': a.delta_input_tons, 'Δ сырьё (%)': a.delta_input_pct,
        'Продукция изм (т)': a.output_measured, 'Продукция согл (т)': a.output_reconciled,
        'Δ продукц (т)': a.delta_output_tons, 'Δ продукц (%)': a.delta_output_pct,
        'Уровень': sev(a),
      }
    } else if (isSpc) {
      row = {
        'Дата': a.date, 'Установка': a.unit_name || '',
        'Загрузка (т)': a.consumed, 'Выпуск (т)': a.produced,
        'Среднее (т)': a.mean, 'Отклонение (σ)': a.value, 'Уровень': sev(a),
      }
    } else if (isCross) {
      row = {
        'Дата': a.date, 'Продукт': a.product, 'Откуда': a.source_unit_name, 'Куда': a.target_unit_name,
        'Отдано (т)': a.output_value, 'Принято (т)': a.input_value,
        'Потери (т)': Math.round(((a.output_value ?? 0) - (a.input_value ?? 0)) * 10) / 10,
        'Δ%': a.value, 'Уровень': sev(a),
      }
    } else {
      row = {
        'Дата': a.date, 'Установка': a.unit_name || '',
        'Описание': a.description, 'Значение': a.value, 'Порог': a.threshold, 'Уровень': sev(a),
      }
    }
    rows.push(row)
    rowOutlines.push(0) // level 2 = no outline

    // Level 3 product rows
    if (includeProducts && (isBalance || isRecon || isSpc)) {
      const key = `${a.unit}__${a.date}`
      const details = productCache[key]
      if (details) {
        const addProducts = (items, direction) => {
          items.forEach(p => {
            let pRow
            if (isBalance) {
              pRow = {
                'Дата': '', 'Установка': `  ${direction}: ${p.product}`,
                'Вход сырья изм (т)': direction === 'Сырьё' ? p.measured : null,
                'Выход продукции изм (т)': direction === 'Продукция' ? p.measured : null,
                'Небаланс (т)': null, 'Небаланс (%)': null, 'Уровень': '',
              }
            } else if (isRecon) {
              pRow = {
                'Дата': '', 'Установка': `  ${direction}: ${p.product}`,
                'Сырьё изм (т)': direction === 'Сырьё' ? p.measured : null,
                'Сырьё согл (т)': direction === 'Сырьё' ? p.reconciled : null,
                'Δ сырьё (т)': direction === 'Сырьё' ? p.delta_tons : null,
                'Δ сырьё (%)': direction === 'Сырьё' ? p.delta_pct : null,
                'Продукция изм (т)': direction === 'Продукция' ? p.measured : null,
                'Продукция согл (т)': direction === 'Продукция' ? p.reconciled : null,
                'Δ продукц (т)': direction === 'Продукция' ? p.delta_tons : null,
                'Δ продукц (%)': direction === 'Продукция' ? p.delta_pct : null,
                'Уровень': '',
              }
            } else if (isSpc) {
              pRow = {
                'Дата': '', 'Установка': `  ${direction}: ${p.product}`,
                'Загрузка (т)': p.measured, 'Выпуск (т)': null,
                'Среднее (т)': null, 'Отклонение (σ)': null, 'Уровень': '',
              }
            }
            if (pRow) {
              rows.push(pRow)
              rowOutlines.push(1) // level 3 = outline 1
            }
          })
        }
        if (details.inputs?.length > 0) addProducts(details.inputs, 'Сырьё')
        if (details.outputs?.length > 0) addProducts(details.outputs, 'Продукция')
      }
    }
  }

  if (rows.length === 0) return

  const ws = XLSX.utils.json_to_sheet(rows)

  // Apply row grouping (outline levels)
  if (includeProducts) {
    ws['!rows'] = rowOutlines.map((level, i) => ({
      outlineLevel: level,
      hidden: level > 0,
    }))
    // Shift by 1 for header row
    ws['!rows'].unshift({})
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, methodLabel.slice(0, 31))
  downloadXlsx(wb, `${methodLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function downloadXlsx(wb, filename) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
