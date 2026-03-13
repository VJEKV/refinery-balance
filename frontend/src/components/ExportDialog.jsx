import { useState, useMemo } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '../api/client'
import { downloadXlsx } from '../utils/excelExport'

function sanitize(str) {
  return str.replace(/[\\/?*[\]]/g, '_')
}

export default function ExportDialog({ isOpen, onClose, method, methodLabel, methodColor, anomalies = [] }) {
  const [severity, setSeverity] = useState('all')
  const [includeProducts, setIncludeProducts] = useState(false)
  const [exporting, setExporting] = useState(false)

  const isDowntime = method === 'downtime'
  const canIncludeProducts = ['balance_closure', 'recon_gap', 'spc'].includes(method)

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
      if (isDowntime) {
        await doExportDowntime(filtered)
      } else {
        await doExport(filtered, method, methodLabel, includeProducts && canIncludeProducts)
      }
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

        {/* Severity filter — not for downtime (no severity on downtime-details) */}
        {!isDowntime && (
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
        )}

        {isDowntime && (
          <div className="mb-4 mt-3 text-sm text-slate-400">
            Будут загружены данные по простоям для всех установок: начало, конец, длительность, тип, факт/норма выпуска, сокращение выпуска, обоснование.
          </div>
        )}

        {canIncludeProducts && (
          <div className="mb-5">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-dark-text hover:bg-white/5 px-2 py-1.5 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={includeProducts}
                onChange={e => setIncludeProducts(e.target.checked)}
                className="accent-blue-500"
              />
              Включить продукты (с группировкой)
            </label>
          </div>
        )}

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

async function fetchDowntimeDetails(unitCode, dateParams) {
  try {
    const resp = await api.get('/anomalies/downtime-details', { params: { unit: unitCode, ...dateParams } })
    return resp.data
  } catch {
    return { events: [] }
  }
}

/* ================================================================
   Export downtime — fetches real downtime-details per unit
   Groups by unit with outline levels
   ================================================================ */
async function doExportDowntime(anomalies) {
  // Collect unique units from downtime anomalies
  const unitMap = new Map()
  for (const a of anomalies) {
    if (!unitMap.has(a.unit)) {
      unitMap.set(a.unit, a.unit_name || a.unit)
    }
  }

  const rows = []
  const rowOutlines = []

  for (const [unitCode, unitName] of unitMap) {
    const data = await fetchDowntimeDetails(unitCode)
    const events = data?.events || []
    if (events.length === 0) continue

    const totalLost = events.reduce((s, e) => s + (e.lost_output_tons ?? 0), 0)

    // Level 0 — unit summary row
    rows.push({
      'Установка': unitName,
      'Начало': '',
      'Конец': '',
      'Дней': events.reduce((s, e) => s + (e.days ?? 0), 0),
      'Часов': events.reduce((s, e) => s + (e.days ?? 0), 0) * 24,
      'Тип': `${events.length} событий`,
      'Факт выпуск (т/сут)': '',
      'Норма выпуск (т/сут)': '',
      'Сокращение выпуска (т)': totalLost,
      'Загрузка (%)': '',
      'Обоснование': '',
    })
    rowOutlines.push(0)

    // Level 1 — each event
    for (const e of events) {
      rows.push({
        'Установка': '',
        'Начало': e.start_date,
        'Конец': e.end_date,
        'Дней': e.days,
        'Часов': e.days * 24,
        'Тип': e.type === 'stop' ? 'Полный простой' : 'Сниженная загрузка',
        'Факт выпуск (т/сут)': e.fact_output ?? 0,
        'Норма выпуск (т/сут)': e.norm_output ?? 0,
        'Сокращение выпуска (т)': e.lost_output_tons ?? 0,
        'Загрузка (%)': e.avg_load_pct,
        'Обоснование': e.reason || '',
      })
      rowOutlines.push(1)
    }
  }

  if (rows.length === 0) return

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 7 },
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 70 },
  ]

  // Apply outline levels
  ws['!rows'] = [{}] // header row
  for (let i = 0; i < rowOutlines.length; i++) {
    ws['!rows'].push({
      outlineLevel: rowOutlines[i],
      hidden: rowOutlines[i] > 0,
    })
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Простои')
  downloadXlsx(wb, `Простои_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/* ================================================================
   Export other methods — with optional product outline levels
   ================================================================ */
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
    rowOutlines.push(0)

    // Product detail rows (outline level 1)
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
                'Небаланс (т)': p.delta_tons, 'Небаланс (%)': p.delta_pct, 'Уровень': '',
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
              rowOutlines.push(1)
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
    ws['!rows'] = [{}] // header row
    for (let i = 0; i < rowOutlines.length; i++) {
      ws['!rows'].push({
        outlineLevel: rowOutlines[i],
        hidden: rowOutlines[i] > 0,
      })
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sanitize(methodLabel).slice(0, 31))
  downloadXlsx(wb, `${sanitize(methodLabel)}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
