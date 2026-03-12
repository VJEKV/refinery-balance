import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch } from 'lucide-react'

const methods = [
  {
    icon: AlertTriangle,
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    name: 'Небаланс вход/выход',
    description: 'Разница между тем, что поступило на установку, и тем, что вышло. Если разница больше порога — возможны потери продукции, ошибки приборов или неучтённые сбросы.',
    risk: 'Неучтённые потери продукции, финансовые убытки.',
    check: 'Акты инвентаризации, журнал нештатных ситуаций, показания приборов на входе и выходе.',
  },
  {
    icon: BarChart3,
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    name: 'Расхождение измерено/согласовано',
    description: 'Приборы показали одно значение, а в согласованном балансе стоит другое. Чем больше разница — тем менее достоверны данные. Причины: неточные приборы, ручные корректировки, ошибки ввода.',
    risk: 'Недостоверные данные учёта, невозможность контролировать реальные объёмы.',
    check: 'Акты проверки приборов, журнал ручных корректировок, протоколы согласования баланса.',
  },
  {
    icon: Activity,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    name: 'Нетипичные дни',
    description: 'Дни, когда загрузка установки резко отличалась от обычного уровня. Порог задаёт допустимое количество отклонений от среднего. Возможны сбои оборудования, ошибки данных или нештатные режимы работы.',
    risk: 'Скрытые проблемы оборудования, нештатные режимы, ошибки ввода данных.',
    check: 'Журнал работы установки за эти дни, заявки на ремонт, данные о переключениях режимов.',
  },
  {
    icon: TrendingUp,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    name: 'Скрытый тренд',
    description: 'Показатели понемногу смещаются в одну сторону день за днём. По отдельности каждый день выглядит нормально, но в сумме видно, что установка работает не так, как раньше. Причины: износ оборудования, изменение качества сырья.',
    risk: 'Постепенный износ оборудования, изменение качества сырья, систематическая ошибка учёта.',
    check: 'Графики обслуживания оборудования, паспорта качества сырья, изменения в технологических картах.',
  },
  {
    icon: Clock,
    color: 'text-dark-muted',
    bg: 'bg-white/5',
    name: 'Простой',
    description: 'Загрузка установки ниже порога от среднего уровня — установка не работала или работала на минимуме. Порог задаёт, при каком проценте от обычной загрузки день считается простоем.',
    risk: 'Потеря выработки, срыв плана, простой связанных установок.',
    check: 'Акты остановки/пуска, заявки на ремонт, графики ТО, причины ограничения загрузки.',
  },
  {
    icon: GitBranch,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    name: 'Потери продукции между установками',
    description: 'Одна установка отдала продукт, а следующая получила меньше. Разница может означать потери при передаче, ошибки учёта или утечки на соединительных трубопроводах.',
    risk: 'Потери продукции на соединительных трубопроводах, ошибки учёта на стыках.',
    check: 'Показания приборов на границах установок, акты передачи продукции, состояние трубопроводов.',
  },
]

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-dark-text">Справка</h1>
      <p className="text-sm text-dark-muted">
        Система анализирует материальный баланс НПЗ и автоматически выявляет аномалии шести типов.
        Ниже описано, что означает каждый тип, какие риски он несёт и какие документы стоит запросить для проверки.
      </p>

      <div className="space-y-4">
        {methods.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.name} className="bg-dark-card border border-dark-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                  <Icon size={18} className={m.color} />
                </div>
                <h2 className="text-base font-semibold text-dark-text">{m.name}</h2>
              </div>
              <p className="text-sm text-dark-muted mb-3">{m.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-accent-red/5 border border-accent-red/20 rounded-lg">
                  <div className="text-xs font-semibold text-accent-red mb-1">Риск</div>
                  <p className="text-xs text-dark-muted">{m.risk}</p>
                </div>
                <div className="p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
                  <div className="text-xs font-semibold text-accent-blue mb-1">Что проверить</div>
                  <p className="text-xs text-dark-muted">{m.check}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-dark-text mb-3">Цветовая шкала тепловой карты</h2>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-dark-muted mb-2">Загрузка / Выпуск (% от среднего за период)</div>
            <div className="flex gap-0.5">
              {[
                { pct: '0%', color: '#4c0519' },
                { pct: '10%', color: '#7f1d1d' },
                { pct: '20%', color: '#b91c1c' },
                { pct: '30%', color: '#dc2626' },
                { pct: '40%', color: '#ea580c' },
                { pct: '50%', color: '#f59e0b' },
                { pct: '60%', color: '#eab308' },
                { pct: '70%', color: '#84cc16' },
                { pct: '80%', color: '#22c55e' },
                { pct: '90%', color: '#16a34a' },
                { pct: '100%', color: '#15803d' },
                { pct: '110%', color: '#6366f1' },
                { pct: '120%+', color: '#7c3aed' },
              ].map(s => (
                <div key={s.pct} className="flex-1 text-center">
                  <div className="h-6 rounded" style={{ backgroundColor: s.color }} />
                  <div className="text-[9px] text-dark-muted mt-0.5">{s.pct}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-dark-muted mt-1">100% = средняя загрузка (без нулевых дней). Зелёный — норма. Фиолетовый — перегрузка.</div>
          </div>
          <div>
            <div className="text-xs font-medium text-dark-muted mb-2">Дисбаланс (загрузка минус выпуск, % от загрузки)</div>
            <div className="flex gap-0.5">
              {[
                { pct: '0–5%', color: '#15803d' },
                { pct: '5–10%', color: '#65a30d' },
                { pct: '10–15%', color: '#eab308' },
                { pct: '15–20%', color: '#f59e0b' },
                { pct: '20–25%', color: '#ea580c' },
                { pct: '25%+', color: '#dc2626' },
              ].map(s => (
                <div key={s.pct} className="flex-1 text-center">
                  <div className="h-6 rounded" style={{ backgroundColor: s.color }} />
                  <div className="text-[9px] text-dark-muted mt-0.5">{s.pct}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-dark-muted mt-1">Зелёный — небольшой дисбаланс (&lt;5%). Красный — большой (&gt;25%).</div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-dark-card border border-dark-border rounded-xl">
        <h2 className="text-sm font-semibold text-dark-text mb-2">Как пользоваться</h2>
        <ul className="text-sm text-dark-muted space-y-1.5 list-disc list-inside">
          <li>Загрузите файлы .xlsm на странице «Загрузка»</li>
          <li>На странице «Обзор» — общая картина: KPI, карточки аномалий по типам, установки</li>
          <li>Нажмите на карточку аномалии — раскроется список установок с этим типом проблемы</li>
          <li>Внутри карточек установок — аккордеоны по каждому типу аномалий с выгрузкой в Excel</li>
          <li>На странице «Потоки» — диаграмма Sankey: как продукция перемещается между установками</li>
          <li>Пороги настраиваются в боковой панели слева — перетащите слайдер и нажмите «Сохранить»</li>
        </ul>
      </div>
    </div>
  )
}
