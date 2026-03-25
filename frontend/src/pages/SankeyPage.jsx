import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import SankeyDiagram from '../components/SankeyDiagram'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { useDateFilter } from '../hooks/useDateFilter'

const MONTH_NAMES = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

function fmtDate(iso) {
  if (!iso) return '—'
  const p = String(iso).slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso
}

export default function SankeyPage() {
  const [dataType, setDataType] = useState('reconciled')
  const [period, setPeriod] = useState('daily')
  const { dateParams } = useDateFilter()
  const [lossesOpen, setLossesOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  const { data: overview } = useQuery({
    queryKey: ['overview', dateParams],
    queryFn: () => api.get('/analytics/overview', { params: dateParams }).then(r => r.data),
  })

  const dates = useMemo(() => overview?.dates || [], [overview])
  const allUnits = useMemo(() => overview?.units || [], [overview])
  const availableMonths = useMemo(() => {
    const set = new Set()
    dates.forEach(d => { const p = d.split('-'); set.add(`${p[0]}-${p[1]}`) })
    return [...set].sort()
  }, [dates])

  // Daily
  const [dateIdx, setDateIdx] = useState(null)
  const activeIdx = dateIdx ?? (dates.length - 1)
  const activeDate = dates[activeIdx] || ''

  // Range
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const effectiveFrom = rangeFrom || (dates[0] || '')
  const effectiveTo = rangeTo || (dates[dates.length - 1] || '')

  // Monthly
  const [selectedMonth, setSelectedMonth] = useState(null)
  const activeMonth = selectedMonth || (availableMonths[availableMonths.length - 1] || '')

  // Unit filter
  const [selectedUnits, setSelectedUnits] = useState(null)
  const toggleUnit = (code) => {
    setSelectedUnits(prev => {
      if (!prev) return new Set([code])
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next.size === 0 ? null : next
    })
  }
  const unitsParam = selectedUnits ? [...selectedUnits].join(',') : undefined

  // API URL
  const sankeyParams = useMemo(() => {
    if (period === 'daily' && activeDate)
      return { url: '/sankey', params: { date: activeDate, type: dataType, units: unitsParam } }
    if (period === 'range' && effectiveFrom && effectiveTo)
      return { url: '/sankey/range', params: { date_from: effectiveFrom, date_to: effectiveTo, type: dataType, units: unitsParam } }
    if (period === 'monthly' && activeMonth) {
      const [y, m] = activeMonth.split('-')
      return { url: '/sankey/monthly', params: { year: parseInt(y), month: parseInt(m), type: dataType, units: unitsParam } }
    }
    return null
  }, [period, activeDate, effectiveFrom, effectiveTo, activeMonth, dataType, unitsParam])

  const { data: sankeyData, isLoading } = useQuery({
    queryKey: ['sankey', period, sankeyParams?.params],
    queryFn: () => api.get(sankeyParams.url, { params: sankeyParams.params }).then(r => r.data),
    enabled: !!sankeyParams,
    placeholderData: keepPreviousData,
  })

  // Extract unique products from links for filter
  const productList = useMemo(() => {
    if (!sankeyData?.links) return []
    const set = new Set()
    sankeyData.links.forEach(l => {
      if (l.product) l.product.split(', ').forEach(p => {
        const clean = p.replace(/\s*\(\+\d+\)/, '').trim()
        if (clean) set.add(clean)
      })
    })
    return [...set].sort()
  }, [sankeyData])

  // Filter sankey data by selected product
  const filteredSankey = useMemo(() => {
    if (!sankeyData || !selectedProduct) return sankeyData
    // We need to get the raw links and filter, but since links are aggregated,
    // we filter by product name substring match
    const filteredLinks = sankeyData.links.filter(l => l.product && l.product.includes(selectedProduct))
    if (!filteredLinks.length) return sankeyData

    // Find which node indices are used
    const usedNodes = new Set()
    filteredLinks.forEach(l => { usedNodes.add(l.source); usedNodes.add(l.target) })

    // Remap nodes
    const oldToNew = {}
    const newNodes = []
    sankeyData.nodes.forEach((n, i) => {
      if (usedNodes.has(i)) {
        oldToNew[i] = newNodes.length
        newNodes.push(n)
      }
    })

    const newLinks = filteredLinks.map(l => ({
      ...l,
      source: oldToNew[l.source],
      target: oldToNew[l.target],
    })).filter(l => l.source !== undefined && l.target !== undefined)

    return { ...sankeyData, nodes: newNodes, links: newLinks }
  }, [sankeyData, selectedProduct])

  const thCls = 'px-3 py-2 border border-dark-border/40 text-xs text-dark-muted text-left'

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-dark-text">Потоки (Sankey)</h1>

      {/* Controls */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
        {/* Period + data type */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-dark-muted">Период:</span>
          <div className="flex rounded-lg border border-dark-border overflow-hidden">
            {[['daily','Сутки'],['range','Диапазон'],['monthly','Месяц']].map(([k,l]) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={`px-3 py-1.5 text-sm transition-colors ${period === k ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'}`}
              >{l}</button>
            ))}
          </div>
          <div className="flex rounded-lg border border-dark-border overflow-hidden ml-auto">
            {[['measured','Измеренное'],['reconciled','Согласованное']].map(([k,l]) => (
              <button key={k} onClick={() => setDataType(k)}
                className={`px-3 py-1.5 text-sm transition-colors ${dataType === k ? 'bg-accent-blue text-white' : 'bg-dark-card text-dark-muted hover:text-dark-text'}`}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* Period controls */}
        {period === 'daily' && (
          <div className="flex items-center gap-3">
            <button onClick={() => setDateIdx(Math.max(0, (dateIdx ?? dates.length - 1) - 1))}
              disabled={activeIdx <= 0}
              className="p-1.5 rounded bg-slate-800 border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-dark-text font-semibold min-w-[120px] text-center">{fmtDate(activeDate)}</span>
            <button onClick={() => setDateIdx(Math.min(dates.length - 1, (dateIdx ?? dates.length - 1) + 1))}
              disabled={activeIdx >= dates.length - 1}
              className="p-1.5 rounded bg-slate-800 border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            <span className="text-xs text-dark-muted">({activeIdx + 1} / {dates.length})</span>
          </div>
        )}

        {period === 'range' && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-dark-muted">С:</label>
            <input type="date" value={effectiveFrom} onChange={e => setRangeFrom(e.target.value)}
              className="bg-slate-800 border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text" />
            <label className="text-sm text-dark-muted">По:</label>
            <input type="date" value={effectiveTo} onChange={e => setRangeTo(e.target.value)}
              className="bg-slate-800 border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text" />
            {filteredSankey?.days_count > 0 && <span className="text-xs text-dark-muted">({filteredSankey.days_count} дней)</span>}
          </div>
        )}

        {period === 'monthly' && (
          <div className="flex flex-wrap gap-2">
            {availableMonths.map(mk => {
              const [y, m] = mk.split('-')
              return (
                <button key={mk} onClick={() => setSelectedMonth(mk)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeMonth === mk ? 'bg-accent-blue text-white' : 'bg-slate-800 text-dark-muted hover:text-dark-text border border-dark-border'
                  }`}
                >{MONTH_NAMES[parseInt(m) - 1]} {y}</button>
              )
            })}
          </div>
        )}

        {/* Unit filter */}
        {allUnits.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-dark-muted">Установки:</span>
            <button onClick={() => setSelectedUnits(null)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${!selectedUnits ? 'bg-accent-blue text-white' : 'bg-slate-800 text-dark-muted hover:text-dark-text'}`}
            >Все</button>
            {allUnits.map(u => (
              <button key={u.code} onClick={() => toggleUnit(u.code)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  selectedUnits?.has(u.code) ? 'bg-accent-blue text-white' : 'bg-slate-800 text-dark-muted hover:text-dark-text'
                }`}
              >{u.name}</button>
            ))}
          </div>
        )}

        {/* Product filter */}
        {productList.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-dark-muted flex items-center gap-1"><Filter size={14} /> Продукт:</span>
            <button onClick={() => setSelectedProduct(null)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${!selectedProduct ? 'bg-accent-green text-white' : 'bg-slate-800 text-dark-muted hover:text-dark-text'}`}
            >Все</button>
            {productList.map(p => (
              <button key={p} onClick={() => setSelectedProduct(selectedProduct === p ? null : p)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  selectedProduct === p ? 'bg-accent-green text-white' : 'bg-slate-800 text-dark-muted hover:text-dark-text'
                }`}
              >{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Sankey */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 overflow-x-auto">
        {isLoading ? (
          <div className="text-dark-muted p-4">Загрузка...</div>
        ) : filteredSankey ? (
          <SankeyDiagram sankeyData={filteredSankey} />
        ) : (
          <div className="text-dark-muted p-4">Выберите период для отображения потоков</div>
        )}
      </div>

      {/* Losses table */}
      {filteredSankey?.losses?.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <button onClick={() => setLossesOpen(!lossesOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
            <h2 className="text-sm font-semibold text-dark-text">
              Потери продукции между установками ({filteredSankey.losses.length})
            </h2>
            {lossesOpen ? <ChevronUp size={16} className="text-dark-muted" /> : <ChevronDown size={16} className="text-dark-muted" />}
          </button>
          {lossesOpen && (
            <div className="overflow-x-auto border-t border-dark-border">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Откуда</th>
                    <th className={thCls}>Куда</th>
                    <th className={thCls}>Продукт</th>
                    <th className={`${thCls} text-right`}>Выход (т)</th>
                    <th className={`${thCls} text-right`}>Вход (т)</th>
                    <th className={`${thCls} text-right`}>Потери (т)</th>
                    <th className={`${thCls} text-right`}>Потери %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSankey.losses.map((l, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-3 py-2 border border-dark-border/20 text-dark-text">{l.source}</td>
                      <td className="px-3 py-2 border border-dark-border/20 text-dark-text">{l.target}</td>
                      <td className="px-3 py-2 border border-dark-border/20 text-dark-muted">{l.product}</td>
                      <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums">{l.output_value.toFixed(1)}</td>
                      <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums">{l.input_value.toFixed(1)}</td>
                      <td className={`px-3 py-2 border border-dark-border/20 text-right tabular-nums ${l.loss > 0 ? 'text-accent-red' : 'text-accent-green'}`}>
                        {l.loss > 0 ? '+' : ''}{l.loss.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 border border-dark-border/20 text-right tabular-nums text-dark-muted">{l.loss_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
