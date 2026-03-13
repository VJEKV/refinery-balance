export default function StatusBadge({ status }) {
  const config = {
    normal: { label: 'Норма', bg: 'bg-accent-green/10', text: 'text-accent-green', dot: 'bg-accent-green' },
    warn: { label: 'Внимание', bg: 'bg-accent-yellow/10', text: 'text-accent-yellow', dot: 'bg-accent-yellow' },
    critical: { label: 'Критично', bg: 'bg-accent-red/10', text: 'text-accent-red', dot: 'bg-accent-red' },
    downtime: { label: 'Простой', bg: 'bg-white/5', text: 'text-dark-muted', dot: 'bg-dark-muted' },
  }

  const { label, bg, text, dot } = config[status] || config.normal

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
