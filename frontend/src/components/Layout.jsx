import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

export default function Layout() {
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  })

  const allDates = overview?.all_dates || overview?.dates || []
  const dateRange = allDates.length > 0 ? `${allDates[0]} — ${allDates[allDates.length - 1]}` : ''
  const availableMonths = overview?.available_months || []

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        fileCount={allDates.length}
        unitCount={overview?.units?.length || 0}
        dateRange={dateRange}
        availableMonths={availableMonths}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-dark-border bg-dark-card flex items-center justify-between px-6 shrink-0">
          <h1 className="text-sm font-semibold text-dark-text">
            Материальный Баланс НПЗ
          </h1>
          <div className="text-xs text-dark-muted">
            {overview?.latest_date || '—'}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-dark-bg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
