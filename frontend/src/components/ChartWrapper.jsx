import { useChartSettings } from '../hooks/useChartSettings'
import ChartSettingsPopover from './ChartSettingsPopover'

export default function ChartWrapper({ chartId, title, children, className = '' }) {
  const { settings, updateSettings, resolved } = useChartSettings(chartId)

  return (
    <div className={`bg-dark-card border border-dark-border rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 relative">
        {title && (
          <h3
            className="text-sm font-semibold text-dark-text"
            style={{ fontFamily: resolved.fontFamily, fontSize: resolved.fontSize.title }}
          >
            {title}
          </h3>
        )}
        <ChartSettingsPopover settings={settings} onUpdate={updateSettings} />
      </div>
      {typeof children === 'function' ? children(resolved) : children}
    </div>
  )
}
