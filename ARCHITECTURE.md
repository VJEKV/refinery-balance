# Архитектура: НПЗ Материальный Баланс — Аналитика Аномалий

## 1. Формат данных (лист ОТЧЕТ_МБ)

```
Строка 4:  [K] дата1          [M] дата2          [O] дата3 ...
Строка 5:  [K] изм   [L] согл  [M] изм   [N] согл ...

Блок установки (повторяется 4–18 раз):
  F = Название установки
  G = «Входящие»
    H = Продукт    I=план/мес  J=план/сут  K=д1_изм  L=д1_согл  M=д2_изм ...
    H = «Суммарно:»
  G = «Исходящие»
    H = Продукт    ...
    H = «Суммарно:»
  G = «Потреблено»     — суммарный вход по дням
  G = «Вырабатано»     — суммарный выход по дням
  G = «Дебаланс»       — тонны (вход − выход)
  G = «Дебаланс отн.»  — доля (НЕ проценты, т.е. 0.03 = 3%)
```

Ключевое: **два потока** — измеренное (приборы) и согласованное (отчёт). Согласованный дебаланс всегда = 0.

### Установки в примере (data/sample.xlsm)

| Установка | Вход(изм) | Вых(изм) | Дебаланс(изм) | Дебаланс отн. |
|-----------|-----------|----------|----------------|---------------|
| Цеха №1,2 Пиролиз | 2768 т | 2859 т | −90 т | 3.27% |
| Цех №2 БПГ | 378 т | 283 т | +95 т | 25.1% |
| Цех №2 Пиротол | 0 т | 0 т | 0 (простой) | — |
| ГПУ-1 | 3163 т | 3221 т | −58 т | 1.85% |

### Межустановочные связи (для Sankey)

```
Пиролиз ── МВФ На гидрирование (16 т) ──────▶ БПГ
Пиролиз ── Смолы С6-С8 На гидрирование (362т)▶ БПГ
БПГ ─────── Смолы С6-С8 На 6 цех (265 т) ───▶ [внешний: цех 6]
ГПУ-1 ───── ШФЛУ от ГПУ-1 на 6 Цех (679 т) ─▶ [внешний: цех 6]
Пиролиз ── Этилен На цех 3 (975 т) ──────────▶ [внешний: цех 3]
[цех 3] ─── Этилен С цеха 3 (44 т) ──────────▶ Пиролиз
[цех 16] ── ФПП из цеха 16 (3.6 т) ──────────▶ Пиролиз
```

Связывание: точное совпадение имени продукта output[A] ↔ input[B]. Также ключевые слова: «На гидрирование», «из цеха X», «на 6 цех».

---

## 2. Стек

- **Backend**: Python FastAPI + pandas in-memory + openpyxl + numpy
- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts + D3 (Sankey) + React Query + React Router + Lucide icons
- **Deploy**: VPS, nginx, systemd, GitHub

---

## 3. API

```
POST /api/upload                           # Загрузить .xlsm → data/
GET  /api/files                            # Список файлов [{filename, dates, units, period}]

GET  /api/units                            # [{code, name}]
GET  /api/units/{code}                     # Детализация одной установки

GET  /api/analytics/overview               # KPI завода: total_in, total_out, imbalance, anomaly_count, downtime_count
GET  /api/analytics/daily?unit=X&month=Y   # Суточные данные
GET  /api/analytics/weekly?unit=X&year=Y
GET  /api/analytics/monthly?unit=X&year=Y
GET  /api/analytics/yearly?unit=X

GET  /api/anomalies?unit=X&method=Y&severity=Z  # Журнал с фильтрами
GET  /api/anomalies/summary                      # {balance: {critical:2, warn:3}, recon: {...}, ...}

GET  /api/sankey?date=2025-01-01&type=measured   # {nodes: [...], links: [...]}
GET  /api/sankey/monthly?year=2025&month=1

GET  /api/settings/thresholds              # Текущие пороги
PUT  /api/settings/thresholds              # Обновить (сохр. в data/thresholds.json)
```

---

## 4. Детекторы аномалий (6 методов)

### 4.1 balance_closure — Невязка МБ
```python
val = abs(summary.imbalance_rel.measured[day]) * 100  # доля → %
if val > threshold (default 3%):
    severity = "critical" if val > threshold * 2 else "warn"
```

### 4.2 recon_gap — Прибор vs Согласованное
```python
# На уровне установки:
gap = abs(consumed.measured[i] - consumed.reconciled[i]) / consumed.measured[i] * 100
# На уровне каждого продукта:
gap = abs(product_meas - product_recon) / product_meas * 100
if gap > threshold (default 5%):
    severity = "critical" if gap > threshold * 2 else "warn"
```

### 4.3 spc — Контрольные карты Шухарта
```python
μ = mean(consumed.measured)  # за весь доступный период
σ = std(consumed.measured)
deviation = abs(value - μ) / σ
if deviation > spc_sigma (default 3):
    → аномалия
elif deviation > spc_sigma - 1:
    → предупреждение
# Визуализация: зоны ±1σ, ±2σ, ±3σ
```

### 4.4 cusum — CUSUM (Page's)
```python
k = μ * 0.005  # допуск (0.5% от среднего)
H = μ * cusum_drift / 100  # порог (default 5% от среднего)
S_plus[0] = S_minus[0] = 0
for i in range(n):
    S_plus[i] = max(0, S_plus[i-1] + (x[i] - μ - k))
    S_minus[i] = max(0, S_minus[i-1] + (-x[i] + μ - k))
    if S_plus[i] > H or S_minus[i] > H:
        → аномалия (дрейф обнаружен)
```

### 4.5 downtime — Простои
```python
μ = mean(consumed.measured, where > 0)  # среднее без нулей
if consumed.measured[i] < μ * downtime_pct / 100:
    → полный простой
elif consumed.measured[i] < μ * 0.5:
    → частичная загрузка
# Также: все входы + выходы = 0 → гарантированный простой
```

### 4.6 cross_unit — Межцеховой баланс
```python
# Для каждого продукта P:
#   Найти unit_A где P в outputs, unit_B где P в inputs
#   loss = output_value[A] - input_value[B]
#   loss_pct = abs(loss) / output_value[A] * 100
if loss_pct > cross_unit threshold (default 5%):
    → аномалия (потери на трассе)
# Эти же данные идут в Sankey
```

---

## 5. Экраны

### 5.1 Layout
```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │ Header: лого МБ + название + загрузить   │
│          │─────────────────────────────────────────-─│
│ 📊 Обзор │ Фильтры: цех | установка | период | дата │
│ 🔍 Устан.│                                          │
│ ⚠ Аномал.│ [Content]                                │
│ 🔀 Потоки│                                          │
│ ⚙ Настр. │                                          │
│ 📁 Файлы │                                          │
│          │                                          │
│ ──────── │                                          │
│ 12 файлов│                                          │
│ 18 устан.│                                          │
└──────────┴──────────────────────────────────────────┘
Тема: #050a18 фон, #0c1529 карточки, #1e293b границы
```

### 5.2 OverviewPage
```
[5 KPI: Вход сырья | Выход продукции | Невязка | Аномалий | Простои]

[Карточка цеха × N]
  Заголовок + кол-во установок
  Таблица: Установка | Вход(изм) | Вход(согл) | Выход(согл) | Невязка% | Δпр/согл | Аномалий | Простои | Статус
  Статус-badge: Норма🟢 / Внимание🟡 / Критично🔴 / Простой⬜
  Клик по строке → UnitDetailPage
```

### 5.3 UnitDetailPage
```
[6 KPI: Вход(изм) | Вход(согл) | Выход(согл) | Невязка% | Δпр/согл | Аномалий]
[Переключатель: Измеренное / Согласованное]

[Табы: Графики | Продукты | События]

Графики:
  1. SPC контрольная карта — линия + зоны ±2σ/±3σ + цветные точки + маркеры простоя
  2. ReconGap — столбцы Δ% по дням, цвет по порогу, пунктиры 3% и 5%
  3. CUSUM — фиолетовая линия + красный порог H + точки пересечения

Продукты:
  Входящие (горизонтальные бары %) | Исходящие (горизонтальные бары %)

События:
  EventLog отфильтрованный по этой установке
```

### 5.4 AnomaliesPage
```
[6 карточек сводки по методам — иконка + название + кол-во + critical/warn]
[Фильтры: Метод | Установка | Критичность | Дата]
[EventLog: Дата | Установка | Метод | Описание | Значение | Порог | Уровень]
```

### 5.5 SankeyPage
```
[Фильтры: Дата | Период (сутки/месяц) | Тип данных (изм/согл)]

[D3 Sankey диаграмма]
  Узлы слева: внешнее сырьё
  Узлы в центре: установки (с вход/выход/потери внутри)
  Узлы справа: внешняя продукция + хранилища
  Связи: толщина = объём (тонн)
  Красные потоки: потери
  Hover: popup с деталями (изм/согл/Δ/%)

[Таблица потерь: Откуда | Куда | Продукт | Выход | Вход | Потери | %]
```

### 5.6 SettingsPage
```
6 слайдеров:
  ⚖️ Невязка МБ          [───●───] 3.0%
  📐 Прибор vs Согласов.  [───●───] 5.0%
  📊 SPC (σ)              [───●───] 3.0σ
  📈 CUSUM дрейф          [───●───] 5.0%
  ⏸️ Простой              [───●───] 10%
  🔗 Межцеховой баланс    [───●───] 5.0%

[Блок рекомендаций: типовые пороги для НПЗ]
[Кнопки: Сохранить | Сбросить]
```

### 5.7 UploadPage
```
[Drag & drop зона для .xlsm]
[Список загруженных файлов: имя | период | дней | установок | кнопка удалить]
```

---

## 6. Sankey Builder

```python
def build_sankey(store, target_date, data_type="reconciled"):
    """
    1. Для каждой установки взять inputs/outputs на target_date
    2. Для каждого output найти matching input в другой установке (по имени продукта)
    3. Match найден → link (source→target, value)
    4. Match НЕ найден → «внешний» выход
    5. Input без source → «внешнее» сырьё
    6. Продукты «Потери *» → узел «Потери» (красный)

    Return {nodes: [{id, type}], links: [{source, target, value, product}]}
    type: "unit" | "external_input" | "external_output" | "losses"
    """
```

---

## 7. Deploy

### nginx.conf
```nginx
server {
    listen 80;
    location / {
        root /opt/refinery-balance/frontend/dist;
        try_files $uri /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        client_max_body_size 50M;
    }
}
```

### systemd
```ini
[Unit]
Description=Refinery Balance
After=network.target
[Service]
User=www-data
WorkingDirectory=/opt/refinery-balance/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
[Install]
WantedBy=multi-user.target
```
