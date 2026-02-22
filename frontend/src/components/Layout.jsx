import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

export default function Layout() {
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        fileCount={overview?.dates?.length || 0}
        unitCount={overview?.units?.length || 0}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-dark-border bg-dark-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent-blue flex items-center justify-center text-white font-bold text-sm">
              МБ
            </div>
            <h1 className="text-lg font-semibold text-dark-text">
              Материальный Баланс НПЗ
            </h1>
          </div>
          <div className="text-sm text-dark-muted">
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
