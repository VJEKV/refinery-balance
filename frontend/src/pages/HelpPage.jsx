import { AlertTriangle, BarChart3, Activity, TrendingUp, Clock, GitBranch, Calculator, Target, BookOpen } from 'lucide-react'

const methods = [
  {
    icon: AlertTriangle,
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    name: 'Небаланс вход/выход',
    description: 'Разница между входом и выходом установки. Внимание — превышение порога, Критично — превышение порога ×2. Пример: порог 3% → Внимание при >3%, Критично при >6%.',
    risk: 'Неучтённые потери продукции, финансовые убытки.',
    check: 'Акты инвентаризации, журнал нештатных ситуаций, показания приборов на входе и выходе.',
  },
  {
    icon: BarChart3,
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    name: 'Расхождение измерено/согласовано',
    description: 'Разница между показаниями приборов и согласованным балансом. Внимание — превышение порога, Критично — превышение порога ×2. Пример: порог 5% → Внимание при >5%, Критично при >10%.',
    risk: 'Недостоверные данные учёта, невозможность контролировать реальные объёмы.',
    check: 'Акты проверки приборов, журнал ручных корректировок, протоколы согласования баланса.',
  },
  {
    icon: Activity,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    name: 'Нетипичные дни',
    description: 'Дни с резким отклонением загрузки от среднего. Внимание — превышение порога (в σ), Критично — превышение порога ×2. Пример: порог 2σ → Внимание при >2σ, Критично при >4σ.',
    risk: 'Скрытые проблемы оборудования, нештатные режимы, ошибки ввода данных.',
    check: 'Журнал работы установки за эти дни, заявки на ремонт, данные о переключениях режимов.',
  },
  {
    icon: TrendingUp,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    name: 'Скрытый тренд',
    description: 'Показатели смещаются в одну сторону день за днём. Внимание — превышение порога, Критично — превышение порога ×2. Причины: износ оборудования, изменение качества сырья.',
    risk: 'Постепенный износ оборудования, изменение качества сырья, систематическая ошибка учёта.',
    check: 'Графики обслуживания оборудования, паспорта качества сырья, изменения в технологических картах.',
  },
  {
    icon: Clock,
    color: 'text-dark-muted',
    bg: 'bg-white/5',
    name: 'Простой',
    description: 'Снижение загрузки относительно нормы (75-й перцентиль рабочих дней). Внимание — снижение больше порога, Критично — снижение больше порога ×2. Полный простой (<1 т на входе и выходе) всегда Критично. Пример: порог 10% → Внимание при снижении >10%, Критично при снижении >20%.',
    risk: 'Потеря выработки, срыв плана, простой связанных установок.',
    check: 'Акты остановки/пуска, заявки на ремонт, графики ТО, причины ограничения загрузки.',
  },
  {
    icon: GitBranch,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    name: 'Потери продукции между установками',
    description: 'Потери при передаче продукта между установками. Внимание — превышение порога, Критично — превышение порога ×2. Пример: порог 5% → Внимание при >5%, Критично при >10%.',
    risk: 'Потери продукции на соединительных трубопроводах, ошибки учёта на стыках.',
    check: 'Показания приборов на границах установок, акты передачи продукции, состояние трубопроводов.',
  },
]

const formulas = [
  {
    name: 'Загрузка / Выпуск (% от плана)',
    formula: 'факт за день / план на день × 100%',
    explain: 'Показывает, насколько установка загружена по сравнению с планом. 100% — план выполнен. Меньше 100% — недозагрузка. Больше 100% — перегрузка.',
    where: 'Тепловая карта загрузки, прогресс-бар в карточке установки.',
  },
  {
    name: 'Небаланс (% потерь)',
    formula: '(загрузка − выпуск) / загрузка × 100%',
    explain: 'Какая доля сырья «потерялась» внутри установки. Например, 5% означает, что из 100 тонн сырья 5 тонн не вышло продуктом. Причины: потери, испарение, неучтённые сбросы, ошибка приборов.',
    where: 'Тепловая карта загрузки (строка «дисбаланс»), аккордеон «Небаланс вход/выход».',
  },
  {
    name: 'Расхождение замер/согласовано',
    formula: '|замер − согласовано| / замер × 100%',
    explain: 'На сколько процентов показание прибора отличается от значения в отчёте. Например, прибор показал 100 т, в отчёт записали 95 т — корректировка 5%. Чем выше процент, тем сильнее «подвинули» прибор при согласовании баланса.',
    where: 'Тепловая карта продуктов, аккордеон «Расхождение», таблица продуктов при раскрытии даты.',
  },
  {
    name: 'Потери между установками',
    formula: '(отдано − принято) / отдано × 100%',
    explain: 'Какая доля продукта потерялась при передаче от одной установки к другой. Например, Пиролиз отдал 100 т бензина, а БПГ принял 97 т — потери 3%.',
    where: 'Аккордеон «Потери продукции между установками».',
  },
  {
    name: 'Нетипичные дни (μ — мю, σ — сигма)',
    formula: '(факт − μ) / σ, где μ = среднее, σ = стандартное отклонение',
    explain: 'μ (мю) — средний уровень загрузки установки за весь период (в тоннах). σ (сигма) — стандартное отклонение, мера разброса загрузки вокруг среднего. Формула показывает, на сколько «сигм» день отклонился от обычного. 2σ — заметное отклонение, 3σ — сильное. Чем больше число, тем необычнее был этот день.',
    where: 'Аккордеон «Нетипичные дни», график SPC (значения μ и σ показаны под графиком).',
  },
  {
    name: 'Доля продукта',
    formula: 'объём продукта / общий объём по направлению × 100%',
    explain: 'Какую часть от всего сырья (или всей продукции) составляет этот конкретный продукт. Помогает понять, какие продукты основные, а какие второстепенные.',
    where: 'Таблица продуктов при раскрытии даты (столбец «Доля»).',
  },
]

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-dark-text">Справка</h1>
      <p className="text-sm text-dark-muted">
        Система анализирует материальный баланс НПЗ и автоматически выявляет аномалии.
        Ниже — как устроена аналитика, что означают проценты, какие проблемы система помогает найти и как ей пользоваться.
      </p>

      {/* === Как работает аналитика === */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <BookOpen size={18} className="text-accent-blue" />
          </div>
          <h2 className="text-base font-semibold text-dark-text">Как работает аналитика</h2>
        </div>
        <div className="space-y-3 text-sm text-dark-muted">
          <p>
            <span className="text-dark-text font-medium">Исходные данные</span> — файлы .xlsm с суточными отчётами установок.
            В каждом файле по каждой установке за каждый день записаны объёмы сырья и продукции в тоннах.
          </p>
          <p>
            <span className="text-dark-text font-medium">Два потока данных:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><span className="text-accent-blue">Замер (измеренное)</span> — что показал прибор (расходомер, уровнемер). Это первичные данные.</li>
            <li><span className="text-accent-green">Согласовано</span> — скорректированное значение из отчёта. После закрытия суток технологи и бухгалтерия согласовывают баланс, и значения могут отличаться от приборных.</li>
          </ul>
          <p>
            <span className="text-dark-text font-medium">План</span> — плановая загрузка на день (из того же файла). Система сравнивает факт с планом, чтобы показать, насколько установка загружена.
          </p>
          <p>
            Система загружает файлы, разбирает данные по установкам, продуктам и дням, а затем автоматически проверяет шесть типов аномалий. Порог срабатывания каждой проверки можно настроить в боковой панели.
          </p>
        </div>
      </div>

      {/* === Как считаются проценты === */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Calculator size={18} className="text-accent-purple" />
          </div>
          <h2 className="text-base font-semibold text-dark-text">Как считаются проценты</h2>
        </div>
        <p className="text-sm text-dark-muted mb-4">
          Во всех таблицах и графиках рядом с процентами есть иконка <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] text-dark-muted">i</span> — наведите на неё, чтобы увидеть формулу.
        </p>
        <div className="space-y-4">
          {formulas.map((f) => (
            <div key={f.name} className="p-3 bg-dark-bg/50 border border-dark-border rounded-lg">
              <div className="text-sm font-medium text-dark-text mb-1">{f.name}</div>
              <div className="text-xs text-accent-blue font-mono mb-2">{f.formula}</div>
              <p className="text-xs text-dark-muted mb-1">{f.explain}</p>
              <p className="text-[11px] text-dark-muted/70">Где используется: {f.where}</p>
            </div>
          ))}
        </div>
      </div>

      {/* === Пороги и уровни алармов === */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent-red/10 flex items-center justify-center">
            <AlertTriangle size={18} className="text-accent-red" />
          </div>
          <h2 className="text-base font-semibold text-dark-text">Пороги и уровни алармов</h2>
        </div>
        <div className="space-y-3 text-sm text-dark-muted">
          <p>
            Каждый тип аномалии имеет <span className="text-dark-text font-medium">один настраиваемый порог</span> (слайдер в боковой панели).
            Из него автоматически рассчитываются два уровня срабатывания:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg">
              <div className="text-xs font-semibold text-accent-yellow mb-1">Внимание (warn)</div>
              <p className="text-xs text-dark-muted">Значение превысило порог. Стоит обратить внимание, но ситуация может быть объяснимой.</p>
            </div>
            <div className="p-3 bg-accent-red/5 border border-accent-red/20 rounded-lg">
              <div className="text-xs font-semibold text-accent-red mb-1">Критично (critical)</div>
              <p className="text-xs text-dark-muted">Значение превысило порог ×2. Серьёзное отклонение, требует проверки.</p>
            </div>
          </div>
          <p className="font-semibold text-dark-text mt-2">Единая формула для всех методов</p>
          <div className="overflow-x-auto border border-slate-600/50 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 bg-slate-800/50">
                  <th className="px-3 py-2 border border-slate-600">Метод</th>
                  <th className="px-3 py-2 border border-slate-600">Внимание</th>
                  <th className="px-3 py-2 border border-slate-600">Критично</th>
                  <th className="px-3 py-2 border border-slate-600">Пример (порог)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-dark-text">Небаланс</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-yellow">&gt; порог</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-red">&gt; порог ×2</td>
                  <td className="px-3 py-1.5 border border-slate-600/70">3% → Внимание &gt;3%, Критично &gt;6%</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-dark-text">Расхождение</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-yellow">&gt; порог</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-red">&gt; порог ×2</td>
                  <td className="px-3 py-1.5 border border-slate-600/70">5% → Внимание &gt;5%, Критично &gt;10%</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-dark-text">Нетипичные дни</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-yellow">&gt; порог σ</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-red">&gt; порог ×2 σ</td>
                  <td className="px-3 py-1.5 border border-slate-600/70">2σ → Внимание &gt;2σ, Критично &gt;4σ</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-dark-text">Скрытый тренд</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-yellow">&gt; порог</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-red">&gt; порог ×2</td>
                  <td className="px-3 py-1.5 border border-slate-600/70">5% → Внимание &gt;H, Критично &gt;2H</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-dark-text">Простой</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-yellow">снижение &gt; порог</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-red">снижение &gt; порог ×2</td>
                  <td className="px-3 py-1.5 border border-slate-600/70">10% → Внимание при снижении &gt;10%, Критично &gt;20%</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-dark-text">Межцеховой</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-yellow">&gt; порог</td>
                  <td className="px-3 py-1.5 border border-slate-600/70 text-accent-red">&gt; порог ×2</td>
                  <td className="px-3 py-1.5 border border-slate-600/70">5% → Внимание &gt;5%, Критично &gt;10%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <span className="text-dark-text font-medium">Исключение:</span> полный простой (загрузка и выпуск &lt; 1 тонны) всегда считается критичным, независимо от порога.
          </p>
          <div className="p-3 bg-white/5 border border-dark-border rounded-lg mt-2">
            <div className="text-dark-text font-medium mb-2">Как работает детекция простоев</div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><span className="text-dark-text">Норма</span> — 75-й перцентиль загрузки за рабочие дни (дни с загрузкой &ge; 1 т). Перцентиль устойчив к выбросам и не занижается простойными днями.</li>
              <li><span className="text-accent-yellow">Внимание</span> — загрузка упала более чем на порог% от нормы. При пороге 10%: загрузка &lt; 90% от нормы.</li>
              <li><span className="text-accent-red">Критично</span> — загрузка упала более чем на порог×2% от нормы. При пороге 10%: загрузка &lt; 80% от нормы.</li>
              <li><span className="text-accent-red">Полный простой</span> — вход и выход &lt; 1 тонны. Всегда критично.</li>
            </ul>
            <div className="mt-2 text-xs text-dark-muted">
              <span className="text-dark-text font-medium">Пример:</span> норма установки = 150 т/сут, порог = 10%.
              Порог «Внимание» = 150 × 0.90 = 135 т. Порог «Критично» = 150 × 0.80 = 120 т.
              Загрузка 100 т → снижение 33% → <span className="text-accent-red">Критично</span>.
              Загрузка 140 т → снижение 7% → норма.
            </div>
            <div className="mt-2 text-xs text-dark-muted">
              <span className="text-dark-text font-medium">Группировка:</span> последовательные дни простоя объединяются в события. Для каждого события система считает длительность (дни и часы), сокращение выпуска в тоннах и % загрузки.
            </div>
          </div>
          <p>
            Пороги настраиваются в боковой панели слева (слайдеры). Меньше порог — больше срабатываний (строже контроль). Больше порог — меньше срабатываний (только крупные отклонения).
          </p>
        </div>
      </div>

      {/* === Что помогает найти === */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent-green/10 flex items-center justify-center">
            <Target size={18} className="text-accent-green" />
          </div>
          <h2 className="text-base font-semibold text-dark-text">Что помогает найти</h2>
        </div>
        <div className="space-y-3 text-sm text-dark-muted">
          <div className="flex gap-3">
            <span className="text-accent-red text-lg leading-none">1</span>
            <div>
              <span className="text-dark-text font-medium">Потери продукции внутри установок.</span> Если на входе 1000 тонн, а на выходе только 900 — куда делись 100 тонн? Небаланс покажет, в какие дни и на каких установках были самые большие потери.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-accent-yellow text-lg leading-none">2</span>
            <div>
              <span className="text-dark-text font-medium">Недостоверные данные учёта.</span> Если прибор показал 500 тонн, а в отчёте записали 400 — кто-то корректировал данные на 20%. Расхождение выявит такие случаи по каждому продукту.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-accent-blue text-lg leading-none">3</span>
            <div>
              <span className="text-dark-text font-medium">Нештатные режимы работы.</span> Нетипичные дни покажут, когда установка работала сильно не так, как обычно — может быть авария, пуск, останов или ошибка в данных.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-dark-muted text-lg leading-none">4</span>
            <div>
              <span className="text-dark-text font-medium">Простои и их стоимость.</span> Система находит дни, когда установка не работала, группирует их в события и считает сокращение выпуска в тоннах — сколько продукции недовыпустили.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-accent-green text-lg leading-none">5</span>
            <div>
              <span className="text-dark-text font-medium">Потери при передаче между установками.</span> Одна установка отдала продукт, а следующая получила меньше. Диаграмма потоков (Sankey) и межцеховой анализ покажут, где и сколько теряется.
            </div>
          </div>
        </div>
      </div>

      {/* === Типы аномалий === */}
      <h2 className="text-lg font-bold text-dark-text pt-2">Типы аномалий</h2>
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

      {/* === Цветовая шкала === */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-dark-text mb-3">Цветовая шкала тепловой карты</h2>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-dark-muted mb-2">Загрузка / Выпуск (% от плана на день)</div>
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
            <div className="text-[10px] text-dark-muted mt-1">100% = план выполнен. Зелёный — норма. Красный — сильно ниже плана. Фиолетовый — перегрузка выше плана.</div>
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
          <div>
            <div className="text-xs font-medium text-dark-muted mb-2">Расхождение по продуктам (|замер − согласовано| / замер)</div>
            <div className="flex gap-0.5">
              {[
                { pct: '0–2%', color: '#064e3b' },
                { pct: '2–5%', color: '#eab308' },
                { pct: '5–15%', color: '#f59e0b' },
                { pct: '15–25%', color: '#dc2626' },
                { pct: '25%+', color: '#4c0519' },
              ].map(s => (
                <div key={s.pct} className="flex-1 text-center">
                  <div className="h-6 rounded" style={{ backgroundColor: s.color }} />
                  <div className="text-[9px] text-dark-muted mt-0.5">{s.pct}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-dark-muted mt-1">Зелёный — прибор и отчёт совпадают. Бордовый — корректировка больше 25%.</div>
          </div>
        </div>
      </div>

      {/* === Инструкция по использованию === */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-dark-text mb-4">Как пользоваться программой</h2>
        <div className="space-y-4 text-sm text-dark-muted">

          <div>
            <div className="text-dark-text font-medium mb-1">1. Загрузка данных</div>
            <p>Откройте страницу «Загрузка» в левом меню. Перетащите файлы .xlsm (суточные отчёты установок) в область загрузки или нажмите кнопку выбора файлов. Можно загружать несколько файлов за разные месяцы — система объединит данные.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">2. Обзорная страница</div>
            <p>После загрузки откройте «Обзор». Вверху — ключевые показатели: суммарный вход и выход продукции, среднее отклонение, количество аномалий и простоев.</p>
            <p className="mt-1">Ниже — карточки аномалий по типам. Нажмите на карточку — раскроется список установок, где есть эта проблема. Внутри карточки установки нажмите на бейдж аномалии — откроется таблица с деталями по дням.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">3. Тепловые карты</div>
            <p><span className="text-dark-text">Тепловая карта загрузки</span> — показывает все установки за выбранный период. Каждая ячейка = один день. Три строки: загрузка (% от плана), выпуск (% от плана), дисбаланс (% потерь). Переключатель «тонны / %» меняет отображение.</p>
            <p className="mt-1"><span className="text-dark-text">Тепловая карта продуктов</span> — на странице установки. Каждая строка = продукт, каждый столбец = день. Показывает, на сколько процентов скорректировали прибор при согласовании. Можно фильтровать по продуктам через теги.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">4. Раскрытие деталей</div>
            <p>В таблицах аномалий нажмите на строку с датой — раскроется подробная таблица по продуктам за этот день. Видно: какой продукт, сколько замерено, сколько согласовано, какая корректировка в тоннах и процентах.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">5. Диаграмма потоков (Sankey)</div>
            <p>Страница «Потоки» показывает, как продукция движется между установками. Ширина полосы = объём продукта. Таблица потерь внизу — по каждому продукту, где есть расхождение между отдачей и приёмкой.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">6. Фильтрация по датам</div>
            <p>В боковой панели слева выберите месяц из выпадающего списка или задайте произвольный диапазон дат. Фильтр применяется ко всем страницам одновременно.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">7. Настройка порогов</div>
            <p>В боковой панели под фильтром дат — слайдеры порогов для каждого типа аномалий. Порог задаёт границу уровня «Внимание». Уровень «Критично» рассчитывается автоматически как порог ×2 (для простоев — порог/2). Перетащите слайдер, чтобы изменить чувствительность, и нажмите «Сохранить». Меньше порог — больше срабатываний (строже контроль). Больше порог — меньше срабатываний (только крупные отклонения).</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">8. Выгрузка в Excel</div>
            <p>Кнопка «Excel» есть в каждом аккордеоне аномалий и на обзорной странице. Выгрузка содержит все данные таблицы, включая раскрытие по продуктам. В Excel работает группировка строк (плюсики слева) — можно сворачивать и разворачивать детали.</p>
          </div>

          <div>
            <div className="text-dark-text font-medium mb-1">9. Подсказки (i)</div>
            <p>Рядом с процентами и показателями есть иконка <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px]">i</span>. Наведите на неё курсор — появится подсказка с формулой расчёта.</p>
          </div>

        </div>
      </div>
    </div>
  )
}
