import { Info } from 'lucide-react'

export default function InfoTooltip({ text, wide }) {
  return (
    <span className="relative group/info inline-flex ml-1 align-middle">
      <Info size={13} className="text-dark-muted hover:text-accent-blue cursor-help transition-colors" />
      <span
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/info:block
          bg-[#f8fafc] text-[#1e293b] text-[11px] leading-relaxed px-3 py-2 rounded-lg shadow-xl
          border border-[#cbd5e1] z-50 pointer-events-none ${wide ? 'min-w-[260px] whitespace-normal' : 'whitespace-nowrap'}`}
      >
        {text}
      </span>
    </span>
  )
}
