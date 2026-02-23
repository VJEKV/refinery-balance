import { useState, useCallback, useMemo, useEffect } from 'react'
import { COLOR_SCHEMES, FONT_OPTIONS, FONT_SIZES, DEFAULT_SETTINGS } from '../theme/chartSchemes'

const STORAGE_PREFIX = 'refinery-chart-settings:'

function loadSettings(chartId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + chartId)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!COLOR_SCHEMES[parsed.scheme]) parsed.scheme = DEFAULT_SETTINGS.scheme
      if (!FONT_OPTIONS.find(f => f.id === parsed.fontId)) parsed.fontId = DEFAULT_SETTINGS.fontId
      if (!FONT_SIZES[parsed.fontSize]) parsed.fontSize = DEFAULT_SETTINGS.fontSize
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch { /* ignore corrupt data */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(chartId, settings) {
  try {
    localStorage.setItem(STORAGE_PREFIX + chartId, JSON.stringify(settings))
    window.dispatchEvent(new CustomEvent('chart-settings-change', { detail: { chartId } }))
  } catch { /* quota exceeded */ }
}

export function useChartSettings(chartId) {
  const [settings, setSettings] = useState(() => loadSettings(chartId))

  // Sync across same-page instances sharing the same chartId (e.g. multiple donut cards)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.chartId === chartId) {
        setSettings(loadSettings(chartId))
      }
    }
    window.addEventListener('chart-settings-change', handler)
    return () => window.removeEventListener('chart-settings-change', handler)
  }, [chartId])

  const updateSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(chartId, next)
      return next
    })
  }, [chartId])

  const resolved = useMemo(() => {
    const scheme = COLOR_SCHEMES[settings.scheme] || COLOR_SCHEMES.classic
    const fontOption = FONT_OPTIONS.find(f => f.id === settings.fontId) || FONT_OPTIONS[0]
    const fontSize = FONT_SIZES[settings.fontSize] || FONT_SIZES.medium
    return {
      colors: scheme.colors,
      schemeName: scheme.name,
      fontFamily: fontOption.family,
      fontLabel: fontOption.label,
      fontSize,
      fontSizeKey: settings.fontSize,
    }
  }, [settings])

  return { settings, updateSettings, resolved }
}
