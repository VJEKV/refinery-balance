import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const DateFilterContext = createContext(null)

const MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
]

export function DateFilterProvider({ children }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedMonths, setSelectedMonths] = useState(new Set()) // empty = all

  const toggleMonth = useCallback((monthIdx) => {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthIdx)) next.delete(monthIdx)
      else next.add(monthIdx)
      return next
    })
    setDateFrom('')
    setDateTo('')
  }, [])

  const selectAll = useCallback(() => {
    setSelectedMonths(new Set())
    setDateFrom('')
    setDateTo('')
  }, [])

  const setRange = useCallback((from, to) => {
    setSelectedMonths(new Set())
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const dateParams = useMemo(() => {
    const p = {}
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    if (selectedMonths.size > 0 && !dateFrom && !dateTo) {
      // Send comma-separated months (1-12)
      p.months = [...selectedMonths].map(m => m + 1).sort((a, b) => a - b).join(',')
    }
    return p
  }, [dateFrom, dateTo, selectedMonths])

  // Back-compat: selectedMonth for components that read single value
  const selectedMonth = selectedMonths.size === 1 ? [...selectedMonths][0] : null

  return (
    <DateFilterContext.Provider value={{
      dateFrom, dateTo, selectedMonth, selectedMonths,
      toggleMonth, selectMonth: toggleMonth, selectAll, setRange, setDateFrom, setDateTo,
      dateParams,
      MONTH_NAMES,
    }}>
      {children}
    </DateFilterContext.Provider>
  )
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext)
  if (!ctx) {
    return {
      dateFrom: '', dateTo: '', selectedMonth: null, selectedMonths: new Set(),
      toggleMonth: () => {}, selectMonth: () => {}, selectAll: () => {},
      setRange: () => {}, setDateFrom: () => {}, setDateTo: () => {},
      dateParams: {},
      MONTH_NAMES: [],
    }
  }
  return ctx
}
