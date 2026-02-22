import { NavLink } from 'react-router-dom'
import { BarChart3, Search, AlertTriangle, GitBranch, Settings, FolderOpen } from 'lucide-react'

const navItems = [
  { to: '/', icon: BarChart3, label: 'Обзор' },
  { to: '/anomalies', icon: AlertTriangle, label: 'Аномалии' },
  { to: '/sankey', icon: GitBranch, label: 'Потоки' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
  { to: '/upload', icon: FolderOpen, label: 'Файлы' },
]

export default function Sidebar({ fileCount = 0, unitCount = 0 }) {
  return (
    <aside className="w-56 bg-dark-card border-r border-dark-border flex flex-col shrink-0">
      <div className="p-4 border-b border-dark-border">
        <div className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
          Навигация
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-dark-border space-y-1">
        <div className="text-xs text-dark-muted">
          {fileCount} дат загружено
        </div>
        <div className="text-xs text-dark-muted">
          {unitCount} установок
        </div>
      </div>
    </aside>
  )
}
