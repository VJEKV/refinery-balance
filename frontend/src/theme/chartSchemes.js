export const COLOR_SCHEMES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    category: 'contrasting',
    colors: {
      primary:   '#3b82f6',
      success:   '#4ade80',
      warning:   '#f59e0b',
      danger:    '#f87171',
      secondary: '#a78bfa',
      muted:     '#94a3b8',
      grid:      '#1e293b',
      tooltip:   { bg: '#f8fafc', border: '#cbd5e1', text: '#1e293b', muted: '#64748b' },
    },
    swatches: ['#3b82f6', '#4ade80', '#f59e0b', '#f87171', '#a78bfa'],
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    category: 'contrasting',
    colors: {
      primary:   '#0ea5e9',
      success:   '#2dd4bf',
      warning:   '#fb923c',
      danger:    '#f43f5e',
      secondary: '#38bdf8',
      muted:     '#94a3b8',
      grid:      '#1e293b',
      tooltip:   { bg: '#f0f9ff', border: '#7dd3fc', text: '#0c4a6e', muted: '#475569' },
    },
    swatches: ['#0ea5e9', '#2dd4bf', '#fb923c', '#f43f5e', '#38bdf8'],
  },
  earth: {
    id: 'earth',
    name: 'Earth',
    category: 'contrasting',
    colors: {
      primary:   '#d97706',
      success:   '#84cc16',
      warning:   '#ea580c',
      danger:    '#dc2626',
      secondary: '#a3e635',
      muted:     '#94a3b8',
      grid:      '#1e293b',
      tooltip:   { bg: '#fffbeb', border: '#fbbf24', text: '#451a03', muted: '#78716c' },
    },
    swatches: ['#d97706', '#84cc16', '#ea580c', '#dc2626', '#a3e635'],
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'neon',
    colors: {
      primary:   '#ec4899',
      success:   '#22d3ee',
      warning:   '#84cc16',
      danger:    '#f43f5e',
      secondary: '#818cf8',
      muted:     '#a5b4fc',
      grid:      '#1e1b4b',
      tooltip:   { bg: '#fdf4ff', border: '#e879f9', text: '#3b0764', muted: '#6b21a8' },
    },
    swatches: ['#ec4899', '#22d3ee', '#84cc16', '#f43f5e', '#818cf8'],
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    category: 'neon',
    colors: {
      primary:   '#a855f7',
      success:   '#06b6d4',
      warning:   '#e879f9',
      danger:    '#fb7185',
      secondary: '#c084fc',
      muted:     '#c4b5fd',
      grid:      '#1e1b4b',
      tooltip:   { bg: '#faf5ff', border: '#c084fc', text: '#3b0764', muted: '#7c3aed' },
    },
    swatches: ['#a855f7', '#06b6d4', '#e879f9', '#fb7185', '#c084fc'],
  },
}

export const FONT_OPTIONS = [
  { id: 'montserrat',     label: 'Montserrat',       family: "'Montserrat', sans-serif" },
  { id: 'inter',          label: 'Inter',             family: "'Inter', sans-serif" },
  { id: 'jetbrains-mono', label: 'JetBrains Mono',    family: "'JetBrains Mono', monospace" },
  { id: 'ibm-plex-sans',  label: 'IBM Plex Sans',     family: "'IBM Plex Sans', sans-serif" },
  { id: 'roboto',         label: 'Roboto',             family: "'Roboto', sans-serif" },
]

export const FONT_SIZES = {
  small:  { axis: 10, label: 11, title: 13, tooltip: 11 },
  medium: { axis: 12, label: 13, title: 15, tooltip: 13 },
  large:  { axis: 14, label: 16, title: 18, tooltip: 15 },
}

export const DEFAULT_SETTINGS = {
  scheme: 'classic',
  fontId: 'montserrat',
  fontSize: 'medium',
}
