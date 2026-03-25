import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useDateFilter } from '../hooks/useDateFilter'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { downloadXlsx, fmtDate } from '../utils/excelExport'

const MONTH_NAMES = {
  '01': 'Янв', '02': 'Фев', '03': 'Мар', '04': 'Апр', '05': 'Май', '06': 'Июн',
  '07': 'Июл', '08': 'Авг', '09': 'Сен', '10': 'Окт', '11': 'Ноя', '12': 'Дек',
}
function shortMonth(mk) { return MONTH_NAMES[mk.slice(5)] || mk }
function fmtDay(iso) { if (!iso) return ''; const p = iso.split('-'); return `${p[2]}.${p[1]}` }

function cellColor(plan, fact) {
  if (!plan || plan === 0) return ''
  const pct = fact / plan * 100
  if (pct < 80) return 'bg-accent-red/25 text-accent-red'
  if (pct < 95) return 'bg-accent-yellow/20 text-accent-yellow'
  if (pct >= 100) return 'text-accent-green'
  return ''
}

function deltaStr(plan, fact) {
  if (!plan) return ''
  const d = fact - plan
  const pct = (d / plan * 100).toFixed(1)
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(1)} т (${sign}${pct}%)`
}

const thCls = 'px-2 py-1.5 border border-slate-600 bg-slate-800/50 text-[11px] font-semibold text-dark-muted whitespace-nowrap text-center'
const tdCls = 'px-2 py-1.5 border border-slate-600/70 text-sm tabular-nums text-right'

export default function PlanFactBlock({ mode = 'input' }) {
  const { dateParams } = useDateFilter()
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [selectedUnits, setSelectedUnits] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  const { data, isFetching } = useQuery({
    queryKey: ['plan-fact', dateParams],
    queryFn: () => api.get('/analytics/plan-fact', { params: dateParams }).then(r => r.data),
  })

  const title = mode === 'input' ? 'Загрузка сырья: План / Факт' : 'Выпуск продукции: План / Факт'
  const months = data?.months || []
  const units = data?.units || []
  const pk = mode === 'input' ? 'plan_in' : 'plan_out'
  const fk = mode === 'input' ? 'fact_in' : 'fact_out'
  const pctKey = mode === 'input' ? 'pct_in' : 'pct_out'
  const totalPlanKey = mode === 'input' ? 'total_plan_in' : 'total_plan_out'
  const totalFactKey = mode === 'input' ? 'total_fact_in' : 'total_fact_out'
  const totalPctKey = mode === 'input' ? 'total_pct_in' : 'total_pct_out'

  const toggleUnit = (code) => {
    setSelectedUnits(prev => {
      if (!prev) return new Set([code])
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next.size === 0 ? null : next
    })
  }

  const chartData = useMemo(() => {
    if (!months.length || !units.length) return []
    const filtered = selectedUnits ? units.filter(u => selectedUnits.has(u.code)) : units
    // Collect all days across all months
    const allDays = []
    for (const mk of months) {
      const daySet = new Set()
      for (const u of filtered) {
        const md = u.months[mk]
        if (md?.days) md.days.forEach(d => daySet.add(d.date))
      }
      const sortedDays = [...daySet].sort()
      for (const d of sortedDays) {
        let planSum = 0, factSum = 0
        for (const u of filtered) {
          const md = u.months[mk]
          if (md?.days) {
            const day = md.days.find(dd => dd.date === d)
            if (day) {
              planSum += mode === 'input' ? day.plan_in : day.plan_out
              factSum += mode === 'input' ? day.fact_in : day.fact_out
            }
          }
        }
        allDays.push({ date: d, label: fmtDay(d), plan: Math.round(planSum), fact: Math.round(factSum) })
      }
    }
    return allDays
  }, [months, units, selectedUnits, mode])

  const dailyData = useMemo(() => {
    if (!expandedMonth) return null
    const mk = expandedMonth
    const allDays = new Set()
    for (const u of units) { const md = u.months[mk]; if (md?.days) md.days.forEach(d => allDays.add(d.date)) }
    return { mk, days: [...allDays].sort() }
  }, [expandedMonth, units])

  const exportExcel = () => {
    if (!data) return
    const rows = []; const outlines = []
    const label = mode === 'input' ? 'Загрузка сырья' : 'Выпуск продукции'
    for (const u of units) {
      const unitRow = { 'Установка': u.name }
      for (const mk of months) { const md = u.months[mk]; unitRow[`${shortMonth(mk)} План`] = md?.[pk] || 0; unitRow[`${shortMonth(mk)} Факт`] = md?.[fk] || 0; unitRow[`${shortMonth(mk)} %`] = md?.[pctKey] || 0 }
      unitRow['Итого План'] = u[totalPlanKey]; unitRow['Итого Факт'] = u[totalFactKey]; unitRow['Итого %'] = u[totalPctKey]
      rows.push(unitRow); outlines.push(0)
      for (const mk of months) { const md = u.months[mk]; if (!md?.days) continue; for (const day of md.days) { const dr = { 'Установка': '', 'Дата': fmtDate(day.date) }; dr[`${shortMonth(mk)} План`] = mode === 'input' ? day.plan_in : day.plan_out; dr[`${shortMonth(mk)} Факт`] = mode === 'input' ? day.fact_in : day.fact_out; rows.push(dr); outlines.push(1) } }
    }
    const ws = XLSX.utils.json_to_sheet(rows); ws['!rows'] = [{}]
    for (let i = 0; i < outlines.length; i++) ws['!rows'].push({ level: outlines[i], hidden: outlines[i] > 0 })
    ws['!outline'] = { above: true }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
    downloadXlsx(wb, `${label}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (!data || !months.length) return null

  const grandTotals = {}
  for (const mk of months) { let sp = 0, sf = 0; for (const u of units) { sp += u.months[mk]?.[pk] || 0; sf += u.months[mk]?.[fk] || 0 }; grandTotals[mk] = { plan: sp, fact: sf } }

  return (
    <div className={`bg-dark-card border border-dark-border rounded-xl p-5 space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-dark-text">{title}</h2>
        <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-dark-muted hover:text-dark-text transition-colors">
          <Download size={14} /> Excel
        </button>
      </div>

      {/* MAIN TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${thCls} text-left sticky left-0 bg-slate-800 z-10 min-w-[160px]`}>Установка</th>
              {months.map(mk => (
                <th key={mk} colSpan={2}
                  className={`${thCls} min-w-[120px] cursor-pointer hover:text-dark-text ${expandedMonth === mk ? 'text-accent-blue' : ''}`}
                  onClick={() => setExpandedMonth(expandedMonth === mk ? null : mk)}
                >
                  <span className="inline-flex items-center gap-1">
                    {shortMonth(mk)}
                    {expandedMonth === mk ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </span>
                </th>
              ))}
              <th colSpan={2} className={`${thCls} min-w-[120px]`}>Итого</th>
              <th className={`${thCls} min-w-[45px]`}>%</th>
            </tr>
            <tr>
              <th className={`${thCls} text-left sticky left-0 bg-slate-800 z-10`}></th>
              {months.map(mk => (
                <React.Fragment key={mk}>
                  <th className={`${thCls} text-slate-300 min-w-[60px]`}>План</th>
                  <th className={`${thCls} text-orange-400 min-w-[60px]`}>Факт</th>
                </React.Fragment>
              ))}
              <th className={`${thCls} text-slate-300 min-w-[60px]`}>План</th>
              <th className={`${thCls} text-orange-400 min-w-[60px]`}>Факт</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {units.map(u => {
              const tp = u[totalPlanKey], tf = u[totalFactKey], tpct = u[totalPctKey]
              const isSelected = !selectedUnits || selectedUnits.has(u.code)
              return (
                <tr key={u.code} className={`hover:bg-white/5 ${!isSelected ? 'opacity-40' : ''}`}>
                  <td className={`${tdCls} text-left sticky left-0 bg-dark-card z-10 font-medium text-dark-text cursor-pointer`} onClick={() => toggleUnit(u.code)}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isSelected ? 'bg-accent-blue' : 'bg-slate-600'}`} />
                    {u.name}
                  </td>
                  {months.map(mk => {
                    const md = u.months[mk]; const plan = md?.[pk] || 0; const fact = md?.[fk] || 0
                    return (
                      <React.Fragment key={mk}>
                        <td className={`${tdCls} text-dark-muted`}>{plan ? plan.toLocaleString('ru') : '—'}</td>
                        <td className={`${tdCls} ${cellColor(plan, fact)}`}
                          onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: deltaStr(plan, fact) })}
                          onMouseLeave={() => setTooltip(null)}
                        >{fact ? fact.toLocaleString('ru') : '—'}</td>
                      </React.Fragment>
                    )
                  })}
                  <td className={`${tdCls} text-dark-muted font-semibold`}>{tp ? tp.toLocaleString('ru') : '—'}</td>
                  <td className={`${tdCls} font-semibold ${cellColor(tp, tf)}`}>{tf ? tf.toLocaleString('ru') : '—'}</td>
                  <td className={`${tdCls} text-center font-semibold ${tpct < 80 ? 'text-accent-red' : tpct < 95 ? 'text-accent-yellow' : 'text-accent-green'}`}>{tpct}%</td>
                </tr>
              )
            })}
            <tr className="font-bold bg-slate-800/50">
              <td className={`${tdCls} text-left sticky left-0 bg-slate-800 z-10 text-dark-text`}>ИТОГО</td>
              {months.map(mk => {
                const gp = grandTotals[mk]?.plan || 0, gf = grandTotals[mk]?.fact || 0
                return (
                  <React.Fragment key={mk}>
                    <td className={`${tdCls} text-slate-300`}>{gp ? Math.round(gp).toLocaleString('ru') : '—'}</td>
                    <td className={`${tdCls} ${cellColor(gp, gf)}`}>{gf ? Math.round(gf).toLocaleString('ru') : '—'}</td>
                  </React.Fragment>
                )
              })}
              {(() => {
                const gtp = Math.round(units.reduce((s, u) => s + u[totalPlanKey], 0))
                const gtf = Math.round(units.reduce((s, u) => s + u[totalFactKey], 0))
                return (
                  <>
                    <td className={`${tdCls} text-slate-300`}>{gtp.toLocaleString('ru')}</td>
                    <td className={`${tdCls} ${cellColor(gtp, gtf)}`}>{gtf.toLocaleString('ru')}</td>
                  </>
                )
              })()}
              <td className={tdCls}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DAILY SUB-TABLE */}
      {dailyData && (
        <div className="bg-slate-900/40 border border-slate-600/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-dark-text">{shortMonth(dailyData.mk)} — по суткам</h3>
            <button onClick={() => setExpandedMonth(null)} className="text-dark-muted hover:text-dark-text"><ChevronUp size={16} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${thCls} text-left sticky left-0 bg-slate-800 z-10 min-w-[160px]`}>Установка</th>
                  {dailyData.days.map(d => (
                    <th key={d} colSpan={2} className={`${thCls} min-w-[90px]`}>{fmtDay(d)}</th>
                  ))}
                  <th colSpan={2} className={`${thCls} min-w-[100px]`}>Итого</th>
                </tr>
                <tr>
                  <th className={`${thCls} text-left sticky left-0 bg-slate-800 z-10`}></th>
                  {dailyData.days.map(d => (
                    <React.Fragment key={d}>
                      <th className={`${thCls} text-slate-300 min-w-[45px]`}>П</th>
                      <th className={`${thCls} text-orange-400 min-w-[45px]`}>Ф</th>
                    </React.Fragment>
                  ))}
                  <th className={`${thCls} text-slate-300 min-w-[50px]`}>П</th>
                  <th className={`${thCls} text-orange-400 min-w-[50px]`}>Ф</th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => {
                  const md = u.months[dailyData.mk]; if (!md?.days?.length) return null
                  const dayMap = {}; md.days.forEach(d => { dayMap[d.date] = d })
                  return (
                    <tr key={u.code} className="hover:bg-white/5">
                      <td className={`${tdCls} text-left sticky left-0 bg-dark-card z-10 font-medium text-dark-text text-xs whitespace-nowrap`}>{u.name}</td>
                      {dailyData.days.map(d => {
                        const day = dayMap[d]; const dp = day ? (mode === 'input' ? day.plan_in : day.plan_out) : 0; const df = day ? (mode === 'input' ? day.fact_in : day.fact_out) : 0
                        return (
                          <React.Fragment key={d}>
                            <td className={`${tdCls} text-dark-muted/60 text-xs`}>{dp ? dp.toLocaleString('ru') : '—'}</td>
                            <td className={`${tdCls} text-xs ${cellColor(dp, df)}`}
                              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: deltaStr(dp, df) })}
                              onMouseLeave={() => setTooltip(null)}
                            >{df ? df.toLocaleString('ru') : '—'}</td>
                          </React.Fragment>
                        )
                      })}
                      <td className={`${tdCls} text-dark-muted font-semibold text-xs`}>{md[pk] ? md[pk].toLocaleString('ru') : '—'}</td>
                      <td className={`${tdCls} font-semibold text-xs ${cellColor(md[pk], md[fk])}`}>{md[fk] ? md[fk].toLocaleString('ru') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tooltip && (
        <div className="fixed z-50 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-sm text-dark-text shadow-lg pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}>{tooltip.text}</div>
      )}

      {/* CHART — daily resolution */}
      <div className="pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <XAxis dataKey="label" stroke="#64748b" fontSize={10} interval={Math.max(0, Math.floor(chartData.length / 20))} angle={-45} textAnchor="end" height={50} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => v.toLocaleString('ru')} />
            <Tooltip
              contentStyle={{ background: '#0c1529', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.date ? fmtDate(payload[0].payload.date) : label}
              formatter={(v, name) => [v.toLocaleString('ru') + ' т', name === 'plan' ? 'План' : 'Факт']}
            />
            <Legend formatter={v => v === 'plan' ? 'План' : 'Факт'} />
            <Line type="monotone" dataKey="plan" stroke="#e2e8f0" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fact" stroke="#fb923c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={() => setSelectedUnits(null)}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${!selectedUnits ? 'bg-accent-blue text-white' : 'bg-slate-700 text-dark-muted hover:text-dark-text'}`}
          >Все</button>
          {units.map(u => (
            <button key={u.code} onClick={() => toggleUnit(u.code)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${selectedUnits?.has(u.code) ? 'bg-accent-blue text-white' : 'bg-slate-700 text-dark-muted hover:text-dark-text'}`}
            >{u.name}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
