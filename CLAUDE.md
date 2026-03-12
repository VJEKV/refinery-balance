# CLAUDE.md — Автономная задача

## Проект
НПЗ Материальный Баланс — full-stack аналитика аномалий нефтеперерабатывающего завода.

## Первый шаг
Прочитай `ARCHITECTURE.md` ЦЕЛИКОМ. Там: формат данных, все API, wireframes 6 экранов, формулы 6 детекторов, алгоритм Sankey.

## Что уже готово
- `ARCHITECTURE.md` — полное ТЗ
- `backend/config.py` — конфигурация (поддержка запуска из .py и .exe)
- `backend/services/parser.py` — **рабочий протестированный парсер** (НЕ ТРОГАЙ)
- `backend/services/store.py` — DataStore с корректным merge данных из нескольких файлов
- `backend/run_server.py` — точка входа для PyInstaller (.exe)
- `server.spec` — конфигурация PyInstaller
- `data/*.xlsm` — реальные файлы для тестирования (3 месяца)
- Структура папок
- **Полностью рабочие backend + frontend**

## Реализованные модули

### Backend (FastAPI + pandas)
| # | Файл | Что делает |
|---|------|------------|
| 1 | `backend/services/store.py` | DataStore — загрузка всех .xlsm в RAM, merge по product (groupby, без дубликатов и NaN) |
| 2 | `backend/services/anomaly.py` | 6 детекторов: balance_closure, recon_gap, spc, cusum, downtime, cross_unit. Понятные описания без жаргона |
| 3 | `backend/services/sankey_builder.py` | Граф потоков: связывание outputs→inputs по имени продукта, внешние узлы, потери |
| 4 | `backend/services/aggregator.py` | Агрегации daily→weekly→monthly→yearly через pandas groupby |
| 5 | `backend/services/product_recon.py` | Анализ расхождений по продуктам (gaps_pct, gaps_tons) |
| 6 | `backend/routers/upload.py` | POST /api/upload, GET /api/files, DELETE /api/files/{name} |
| 7 | `backend/routers/units.py` | GET /api/units, GET /api/units/{code} (детализация с SPC/CUSUM/ReconGap, фильтр по дате: date_from/date_to/month) |
| 8 | `backend/routers/analytics.py` | GET /api/analytics/overview, /heatmap, /product-heatmap (с month), /daily, /weekly, /monthly, /yearly |
| 9 | `backend/routers/anomalies.py` | GET /api/anomalies (фильтры по unit/method/severity/date), /summary, /downtime-details (события с начало/конец/дни/обоснование, фильтр по unit) |
| 10 | `backend/routers/sankey.py` | GET /api/sankey?date=...&type=measured|reconciled, /monthly |
| 11 | `backend/routers/settings.py` | GET/PUT /api/settings/thresholds, POST /reset |
| 12 | `backend/main.py` | FastAPI app + CORS + lifespan + роутеры + раздача frontend/dist (production) |
| 13 | `backend/run_server.py` | Точка входа для PyInstaller .exe (uvicorn embedded) |

### Frontend (React 18 + Vite + Tailwind)
| # | Файл | Что делает |
|---|------|------------|
| 1 | Setup | vite, react, tailwind, react-router-dom, @tanstack/react-query, recharts, d3-sankey, axios, lucide-react |
| 2 | `src/App.jsx` | Роутинг |
| 3 | `src/api/client.js` | axios baseURL=/api (относительный — работает через один порт) |
| 4 | `src/components/Layout.jsx` | Sidebar + Header + Content |
| 5 | `src/components/Sidebar.jsx` | Навигация + фильтр дат (месяцы/range) + методы с описаниями и слайдерами порогов |
| 6 | `src/components/KPICard.jsx` | Плашка: label + value + unit + trend |
| 7 | `src/components/UnitCard.jsx` | Карточка установки: план/факт, кликабельные бейджи аномалий по типам → аккордеон с таблицей и Excel-выгрузкой, простои с начало/конец/дни/обоснование |
| 8 | `src/components/StatusBadge.jsx` | Норма/Внимание/Критично/Простой |
| 9 | `src/components/ControlChart.jsx` | SPC: линия + зоны ±2σ/±3σ + цветные точки + раскрывающееся описание (риски, что запросить) |
| 10 | `src/components/ReconGapChart.jsx` | Столбцы Δ% по дням + статистика + раскрывающееся описание |
| 11 | `src/components/CusumChart.jsx` | Линия CUSUM + порог H + статистика превышений + раскрывающееся описание |
| 12 | `src/components/ReconHeatmap.jsx` | Тепловая карта расхождений по продуктам + фильтр продуктов (теги-чипы) + исправленная цветовая шкала (зелёный→бордовый) + dateParams |
| 13 | `src/components/HeatmapChart.jsx` | SVG heatmap загрузки установок по дням |
| 14 | `src/components/AnomalyBarChart.jsx` | Стек аномалий по методам |
| 15 | `src/components/DonutChart.jsx` | Canvas-бублик (изм/согл/отклонение) |
| 16 | `src/components/SankeyDiagram.jsx` | D3 Sankey потоков между установками |
| 17 | `src/components/EventLog.jsx` | Таблица аномалий |
| 18 | `src/pages/OverviewPage.jsx` | KPI + карточки аномалий по методам (клик → фильтрация установок) + сетка карточек установок + heatmap |
| 19 | `src/pages/UnitDetailPage.jsx` | KPI + SPC + CUSUM + ReconGap + продукты. Использует глобальный dateParams |
| 20 | `src/pages/AnomaliesPage.jsx` | 6 карточек методов (с описаниями) + фильтры (установка/уровень/метод) + экспорт Excel (.xlsx) + карточка простоев с аналитикой выработки |
| 21 | `src/pages/SankeyPage.jsx` | Sankey + выбор даты + таблица потерь |
| 22 | `src/pages/UploadPage.jsx` | Drag&drop загрузка |
| 23 | `src/hooks/useDateFilter.jsx` | Глобальный контекст фильтра дат |
| 24 | `src/hooks/useChartSettings.js` | Настройки графиков (палитра, шрифт, размер) |
| 25 | `src/theme/arctic.js` | Цветовая тема ARCTIC DARK |

### Deploy и запуск
| Файл | Что |
|------|-----|
| `requirements.txt` | fastapi uvicorn openpyxl pandas numpy python-multipart aiofiles |
| `frontend/package.json` | React 18 + Vite + Recharts + D3 + TanStack Query + Lucide + xlsx |
| `deploy/nginx.conf` | static + proxy (VPS) |
| `deploy/refinery.service` | systemd (VPS) |
| `server.spec` | PyInstaller — конфигурация сборки .exe |
| `BUILD.bat` | Одноразовая сборка server.exe на Windows |
| `START.bat` | Запуск server.exe + открытие браузера |
| `STOP.bat` | Остановка server.exe |
| `UPDATE.bat` | Обновление с GitHub (сохраняет data/ и thresholds.json) |
| `start.sh` | Запуск dev (Linux) |
| `.github/workflows/build-exe.yml` | GitHub Actions: сборка Windows .exe на windows-latest (workflow_dispatch) |
| `NPZ_MB.zip` | Собранный архив с server.exe + frontend/dist + батники (39 МБ) |
| `.gitignore` | data/*.xlsm, node_modules, __pycache__, dist, build/, release/ |

---

## Запуск на локальном ПК (без установки Python)

### Вариант 1: Скачать готовый архив
1. Скачать `NPZ_MB.zip` из репозитория (собран через GitHub Actions)
2. Распаковать на флешку/SSD

### Вариант 2: Собрать через GitHub Actions
1. GitHub → Actions → «Build Windows EXE» → Run workflow
2. Скачать артефакт `NPZ_MB` после сборки

### Вариант 3: Собрать локально
1. Скачать репо с GitHub
2. Установить Python 3.11+ (только для сборки)
3. Запустить `BUILD.bat` — создаст папку `release\НПЗ_МБ\`
4. Скопировать `НПЗ_МБ\` на флешку/SSD

### Структура на флешке
```
НПЗ_МБ\
├── START.bat              # Двойной клик = запуск
├── STOP.bat               # Остановка
├── server\
│   └── server.exe         # Python + FastAPI + pandas (всё внутри, ~240 МБ)
├── frontend\
│   └── dist\              # Собранный React-интерфейс
└── data\                  # Сюда пользователь кладёт .xlsm файлы
    └── thresholds.json    # Настройки порогов (создаётся автоматически)
```

### Использование на любом ПК
1. Вставить флешку
2. Положить `.xlsm` файлы в `data\`
3. Двойной клик по `START.bat`
4. Открывается браузер → `http://127.0.0.1:8000`

**Не нужно:** установка Python, Node.js, интернет, права администратора.
**Нужно:** Windows 7+, любой браузер.

### Обновление
`UPDATE.bat` — скачивает новую версию с GitHub, заменяет backend/frontend, сохраняет data/ и thresholds.json.

---

## Запуск на VPS (dev / production)

### Dev-режим
```bash
# Backend
cd backend
pip install -r ../requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev    # → http://localhost:5445, proxy /api → 8000
```

### Production (VPS)
```bash
# Собрать frontend
cd frontend && npm run build

# Backend раздаёт frontend/dist через StaticFiles
# Один порт 8000 для всего
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000

# Или через systemd:
cp deploy/refinery.service /etc/systemd/system/
systemctl enable --now refinery

# Nginx (опционально, для порта 80):
cp deploy/nginx.conf /etc/nginx/sites-available/refinery
```

---

## Стиль фронтенда
Тёмная тема ARCTIC DARK: #050a18 фон, #0c1529 карточки, #1e293b границы, #e2e8f0 текст.
Акценты: #3b82f6 синий, #f59e0b жёлтый, #4ade80 зелёный, #f87171 красный, #a855f7 фиолетовый, #22d3ee циан.
Шрифт Inter. Иконки Lucide. 5 палитр графиков (classic, ocean, earth, cyberpunk, synthwave).

## Последняя сборка
- **Дата:** 12 марта 2026
- **GitHub Actions run:** #22989187283
- **Артефакт:** `NPZ_MB` — готовый Windows .exe (server.exe + frontend/dist + START/STOP.bat)
- **Скачать:** GitHub → Actions → «Build Windows EXE» → последний успешный запуск → Artifacts → NPZ_MB
- Сборка включает все последние изменения UI (Overview, аномалии, Sidebar, HelpPage, anomaly.py)

## Последние доработки (март 2026)

### Глобальный фильтр дат
- Фильтр из Sidebar (месяц / диапазон дат) теперь применяется ко ВСЕМ страницам и компонентам
- Backend: `units.py` GET /api/units/{code} принимает date_from/date_to/month
- Backend: `analytics.py` product-heatmap принимает month
- Frontend: UnitDetailPage и UnitCard передают dateParams в запросы и в ReconHeatmap

### Аналитика с описаниями
- ControlChart, CusumChart, ReconGapChart — раскрывающиеся панели (ℹ): что показывает график, на что обратить внимание, что запросить
- Статистика нарушений прямо под графиком (количество дней за нормой, средние, максимумы)
- Все тексты написаны понятным языком без технического жаргона

### Карточки аномалий на обзорной странице
- Под KPI — 6 карточек аномалий по методам (потери, расхождение, выход за норму, сдвиг, простой, межцеховой)
- Клик по карточке → установки фильтруются, показываются только с этим типом аномалий
- В карточке установки — кликабельные бейджи аномалий по типам → раскрывают аккордеон с деталями

### Простои с группировкой в события
- GET /api/anomalies/downtime-details — последовательные дни группируются в события
- Каждое событие: начало, конец, количество дней, обоснование (автоматическое)
- Потери в тоннах (сырьё + продукция), % от нормы
- Excel-выгрузка простоев по каждой установке
- Рекомендации: какие документы запросить у технологов

### Аккордеоны аномалий в карточках установок
- Каждый тип аномалий (потери, расхождение, SPC, CUSUM, простои, межцеховой) имеет свой аккордеон
- Таблица событий + кнопка «Excel» для выгрузки
- При клике на карточку метода на KPI → в карточках установок открывается только этот аккордеон

### Фильтр продуктов на тепловых картах
- ReconHeatmap: теги-чипы для мультивыбора продуктов
- Работает и на странице установки, и внутри карточек на обзорной странице

### Цветовая шкала
- Исправлена: зелёный → жёлтый → красный → тёмно-бордовый (при высоких отклонениях цвет темнеет)

### Фильтрация и экспорт аномалий
- Фильтры: по установке, по уровню (критично/внимание), по методу
- Экспорт в Excel (.xlsx) с основными данными
- Описание каждого метода аномалий на карточках (ℹ)

---

## Критически важно
- **НЕ переписывай parser.py** — он работает и протестирован
- **Никакой БД** — только pandas in-memory
- Два потока: **измеренное** (приборы) и **согласованное** (отчёт)
- Согласованный дебаланс всегда = 0
- **store.py _merge_unit()** — groupby по product, НЕ простой concat (иначе дубли и NaN при нескольких файлах)
- **config.py / main.py** — пути через `sys.frozen` для совместимости с PyInstaller .exe
- Тестируй backend через `/docs` (Swagger UI)
- В реальных данных: до 18 установок × 31 день × 12 месяцев

## Порядок разработки
1. Backend целиком → проверить /docs
2. Frontend целиком
3. `npm run build` → проверить production через один порт
4. `BUILD.bat` → проверить .exe на Windows
