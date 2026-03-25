import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'
import { ChevronDown, ChevronUp, Download, RefreshCw, Info } from 'lucide-react'
import * as XLSX from 'xlsx'
import { downloadXlsx, fmtDate } from '../utils/excelExport'

const thCls = 'px-3 py-2 border border-slate-600 bg-slate-800/50 text-xs font-semibold text-dark-muted whitespace-nowrap'
const tdCls = 'px-3 py-2 border border-slate-600/70 text-sm tabular-nums'
const HEX = '#a855f7'
const DESC = 'Дни, в которых показания приборов (замер) были скорректированы до согласованных значений. Чем больше корректировка — тем сильнее расхождение между реальными данными и отчётными. Причины: дрейф датчиков, ручные правки, ошибки ввода.'

function statusBadge(maxPct) {
  if (maxPct > 5) return { label: 'Критично', cls: 'bg-accent-red/20 text-accent-red', dot: 'bg-accent-red' }
  if (maxPct > 2) return { label: 'Внимание', cls: 'bg-accent-yellow/20 text-accent-yellow', dot: 'bg-accent-yellow' }
  return { label: 'Норма', cls: 'bg-accent-green/20 text-accent-green', dot: 'bg-accent-green' }
}

export default function CorrectionsBlock() {
  const { dateParams } = useDateFilter()
  const [isOpen, setIsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [thresholdPct, setThresholdPct] = useState(1)
  const [minCount, setMinCount] = useState(1)
  const [expanded, setExpanded] = useState(null)

  const { data, isFetching } = useQuery({
    queryKey: ['corrections', dateParams],
    queryFn: () => api.get('/analytics/corrections', { params: dateParams }).then(r => r.data),
  })

  const products = data?.products || []

  const filtered = useMemo(() => {
    return products.map(p => {
      const fe = p.events.filter(e => Math.abs(e.delta_pct) >= thresholdPct)
      return { ...p, filteredEvents: fe, filteredCount: fe.length }
    }).filter(p => p.filteredCount >= minCount)
  }, [products, thresholdPct, minCount])

  const summary = useMemo(() => {
    let total = 0, critical = 0, warn = 0
    for (const p of filtered) { total++; if (p.max_delta_pct > 5) critical++; else if (p.max_delta_pct > 2) warn++ }
    return { total, critical, warn }
  }, [filtered])

  const exportExcel = (e) => {
    e.stopPropagation()
    if (!filtered.length) return
    const rows = [], outlines = []
    for (const p of filtered) {
      const st = statusBadge(p.max_delta_pct)
      rows.push({ 'Продукт': p.product, 'Тип': p.direction, 'Кол-во корр.': p.filteredCount, 'Ср. Δ (т)': p.avg_delta_tons, 'Макс |Δ| (%)': p.max_delta_pct, 'Статус': st.label })
      outlines.push(0)
      for (const ev of p.filteredEvents) {
        rows.push({ 'Продукт': '', 'Дата': fmtDate(ev.date), 'Замер (т)': ev.measured, 'Согласов (т)': ev.reconciled, 'Δ (т)': ev.delta_tons, 'Δ (%)': ev.delta_pct, 'Установка': ev.unit_name })
        outlines.push(1)
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows); ws['!rows'] = [{}]
    for (let i = 0; i < outlines.length; i++) ws['!rows'].push({ level: outlines[i], hidden: outlines[i] > 0 })
    ws['!outline'] = { above: true }
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Корректировки')
    downloadXlsx(wb, `Корректировки_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (!data || !products.length) return null

  return (
    <div className="bg-dark-card border rounded-xl overflow-hidden" style={{
      borderColor: `${HEX}60`,
      boxShadow: `0 0 10px ${HEX}30, 0 0 25px ${HEX}15, inset 0 0 8px ${HEX}08`,
    }}>
      {/* Header */}
      <div className="flex items-center">
        <button onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
            <RefreshCw size={16} className="text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-dark-text flex items-center gap-2">
              Корректировки продуктов
              <button onClick={(e) => { e.stopPropagation(); setInfoOpen(v => !v) }}
                className={`p-0.5 rounded transition-colors ${infoOpen ? 'text-accent-blue bg-accent-blue/10' : 'text-dark-muted hover:text-dark-text'}`}
                title="Описание метода"><Info size={16} /></button>
            </div>
            <div className="flex gap-3 mt-0.5 text-sm">
              <span className="text-dark-muted">Всего: {summary.total}</span>
              {summary.critical > 0 && <span className="text-accent-red flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent-red" />{summary.critical} критично</span>}
              {summary.warn > 0 && <span className="text-accent-yellow flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />{summary.warn} внимание</span>}
            </div>
          </div>
          {summary.total > 0
            ? (isOpen ? <ChevronUp size={18} className="text-dark-muted shrink-0" /> : <ChevronDown size={18} className="text-dark-muted shrink-0" />)
            : <span className="text-xs text-dark-muted shrink-0">нет</span>}
        </button>
        {summary.total > 0 && (
          <button onClick={exportExcel}
            className="mr-4 flex items-center gap-1 px-2 py-1 text-sm bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/20 shrink-0">
            <Download size={12} /> Excel
          </button>
        )}
      </div>

      {/* Info */}
      {infoOpen && (
        <div className="mx-4 mb-3 px-3 py-2 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
          <p className="text-sm text-slate-300 leading-relaxed">{DESC}</p>
        </div>
      )}

      {/* Content */}
      {isOpen && summary.total > 0 && (
        <div className={`border-t border-dark-border transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {/* Sliders */}
          <div className="p-4 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-dark-muted mb-1 block">Порог |Δ%|: <span className="text-dark-text font-semibold">{thresholdPct}%</span></label>
              <input type="range" min={1} max={100} value={thresholdPct} onChange={e => setThresholdPct(Number(e.target.value))} className="w-full accent-purple-400" />
              <div className="flex justify-between text-xs text-dark-muted mt-0.5"><span>1%</span><span>100%</span></div>
            </div>
            <div>
              <label className="text-sm text-dark-muted mb-1 block">Мин. кол-во корр.: <span className="text-dark-text font-semibold">{minCount}</span></label>
              <input type="range" min={1} max={100} value={minCount} onChange={e => setMinCount(Number(e.target.value))} className="w-full accent-purple-400" />
              <div className="flex justify-between text-xs text-dark-muted mt-0.5"><span>1</span><span>100</span></div>
            </div>
          </div>
          <div className="px-4 pb-3 text-xs text-dark-muted">
            Фильтр: |Δ%| &ge; {thresholdPct}% и кол-во &ge; {minCount} — найдено: <span className="text-dark-text font-semibold">{filtered.length}</span>
          </div>

          {/* Products TABLE */}
          <div className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${thCls} w-8`}></th>
                    <th className={`${thCls} text-left`}>Продукт</th>
                    <th className={thCls}>Тип</th>
                    <th className={thCls}>Кол-во корр.</th>
                    <th className={thCls}>Ср. Δ (т)</th>
                    <th className={thCls}>Макс |Δ| (%)</th>
                    <th className={thCls}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const st = statusBadge(p.max_delta_pct)
                    const isExp = expanded === p.product
                    return (
                      <React.Fragment key={p.product}>
                        <tr className="hover:bg-white/5 cursor-pointer" onClick={() => setExpanded(isExp ? null : p.product)}>
                          <td className={`${tdCls} text-center`}>
                            {isExp ? <ChevronUp size={14} className="text-dark-muted inline" /> : <ChevronDown size={14} className="text-dark-muted inline" />}
                          </td>
                          <td className={`${tdCls} text-left font-medium text-dark-text`}>
                            <span className="inline-flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                              {p.product}
                            </span>
                          </td>
                          <td className={`${tdCls} text-center text-dark-muted`}>{p.direction}</td>
                          <td className={`${tdCls} text-center font-semibold`}>{p.filteredCount}</td>
                          <td className={`${tdCls} text-center ${p.avg_delta_tons >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {p.avg_delta_tons >= 0 ? '+' : ''}{p.avg_delta_tons.toFixed(1)}
                          </td>
                          <td className={`${tdCls} text-center font-semibold`}>{p.max_delta_pct.toFixed(1)}%</td>
                          <td className={`${tdCls} text-center`}>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                          </td>
                        </tr>

                        {/* Accordion detail */}
                        {isExp && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-slate-900/40 border-t border-b border-slate-600/30 px-6 py-3">
                                <div className="text-xs text-dark-muted mb-2 font-semibold">
                                  {p.product} — {p.filteredCount} корректировок (|Δ%| &ge; {thresholdPct}%)
                                </div>
                                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                                  <table className="w-full border-collapse text-xs">
                                    <thead>
                                      <tr>
                                        <th className={`${thCls} text-left`}>Дата</th>
                                        <th className={thCls}>Замер (т)</th>
                                        <th className={thCls}>Согласов (т)</th>
                                        <th className={thCls}>Δ (т)</th>
                                        <th className={thCls}>Δ (%)</th>
                                        <th className={`${thCls} text-left`}>Установка</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.filteredEvents.map((e, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                          <td className={`${tdCls} text-left`}>{fmtDate(e.date)}</td>
                                          <td className={`${tdCls} text-center`}>{e.measured.toFixed(1)}</td>
                                          <td className={`${tdCls} text-center`}>{e.reconciled.toFixed(1)}</td>
                                          <td className={`${tdCls} text-center ${e.delta_tons >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                            {e.delta_tons >= 0 ? '+' : ''}{e.delta_tons.toFixed(1)}
                                          </td>
                                          <td className={`${tdCls} text-center font-semibold ${Math.abs(e.delta_pct) > 5 ? 'text-accent-red' : Math.abs(e.delta_pct) > 2 ? 'text-accent-yellow' : ''}`}>
                                            {e.delta_pct >= 0 ? '+' : ''}{e.delta_pct.toFixed(2)}%
                                          </td>
                                          <td className={`${tdCls} text-left text-dark-muted`}>{e.unit_name}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
