import { createContext, useContext, useState, useCallback } from 'react'

const DateFilterContext = createContext(null)

const MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
]

export function DateFilterProvider({ children }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(null) // null = all

  const selectMonth = useCallback((monthIdx) => {
    if (monthIdx === selectedMonth) {
      // Deselect
      setSelectedMonth(null)
      setDateFrom('')
      setDateTo('')
    } else {
      setSelectedMonth(monthIdx)
      // We don't set dateFrom/dateTo here — API will use month param
      setDateFrom('')
      setDateTo('')
    }
  }, [selectedMonth])

  const selectAll = useCallback(() => {
    setSelectedMonth(null)
    setDateFrom('')
    setDateTo('')
  }, [])

  const setRange = useCallback((from, to) => {
    setSelectedMonth(null)
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const dateParams = {}
  if (dateFrom) dateParams.date_from = dateFrom
  if (dateTo) dateParams.date_to = dateTo
  if (selectedMonth !== null && !dateFrom && !dateTo) {
    dateParams.month = selectedMonth + 1
  }

  return (
    <DateFilterContext.Provider value={{
      dateFrom, dateTo, selectedMonth,
      selectMonth, selectAll, setRange, setDateFrom, setDateTo,
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
      dateFrom: '', dateTo: '', selectedMonth: null,
      selectMonth: () => {}, selectAll: () => {},
      setRange: () => {}, setDateFrom: () => {}, setDateTo: () => {},
      dateParams: {},
      MONTH_NAMES: [],
    }
  }
  return ctx
}
