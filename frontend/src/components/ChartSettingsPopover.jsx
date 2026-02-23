import { useState, useRef, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { COLOR_SCHEMES, FONT_OPTIONS, FONT_SIZES } from '../theme/chartSchemes'

const schemes = Object.values(COLOR_SCHEMES)
const sizeLabels = { small: 'S', medium: 'M', large: 'L' }

export default function ChartSettingsPopover({ settings, onUpdate }) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className="p-1 rounded hover:bg-white/10 text-dark-muted hover:text-dark-text transition-colors"
        title="Настройки графика"
      >
        <Settings size={14} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-8 z-50 w-64 bg-dark-card border border-dark-border rounded-xl shadow-2xl p-3 space-y-3"
        >
          {/* Color schemes */}
          <div>
            <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              Цветовая схема
            </div>
            <div className="space-y-1">
              {schemes.map(scheme => (
                <button
                  key={scheme.id}
                  onClick={() => onUpdate({ scheme: scheme.id })}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    settings.scheme === scheme.id
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
                  }`}
                >
                  <div className="flex gap-0.5">
                    {scheme.swatches.slice(0, 4).map((c, i) => (
                      <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span>{scheme.name}</span>
                  {scheme.category === 'neon' && (
                    <span className="text-[0.6rem] text-dark-muted ml-auto">neon</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div>
            <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              Шрифт
            </div>
            <div className="space-y-0.5">
              {FONT_OPTIONS.map(font => (
                <button
                  key={font.id}
                  onClick={() => onUpdate({ fontId: font.id })}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    settings.fontId === font.id
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
                  }`}
                  style={{ fontFamily: font.family }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div className="text-[0.65rem] font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              Размер текста
            </div>
            <div className="flex gap-1">
              {Object.keys(FONT_SIZES).map(size => (
                <button
                  key={size}
                  onClick={() => onUpdate({ fontSize: size })}
                  className={`flex-1 px-2 py-1 rounded text-xs text-center transition-colors ${
                    settings.fontSize === size
                      ? 'bg-accent-blue text-white'
                      : 'bg-dark-bg text-dark-muted hover:text-dark-text border border-dark-border'
                  }`}
                >
                  {sizeLabels[size]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
