# CLAUDE.md — Автономная задача

## Проект
НПЗ Материальный Баланс — full-stack аналитика аномалий нефтеперерабатывающего завода.

## Первый шаг
Прочитай `ARCHITECTURE.md` ЦЕЛИКОМ. Там: формат данных, все API, wireframes 6 экранов, формулы 6 детекторов, алгоритм Sankey.

## Что уже готово
- `ARCHITECTURE.md` — полное ТЗ
- `backend/config.py` — конфигурация
- `backend/services/parser.py` — **рабочий протестированный парсер** (НЕ ТРОГАЙ)
- `data/sample.xlsm` — реальный файл для тестирования
- Структура папок

## Что реализовать

### Backend (FastAPI + pandas)
| # | Файл | Что делает |
|---|------|------------|
| 1 | `backend/services/store.py` | DataStore — загрузка всех .xlsm в RAM через parser.py, методы get_unit_daily(), get_unit_names() и т.д. |
| 2 | `backend/services/anomaly.py` | 6 детекторов: balance_closure, recon_gap, spc, cusum, downtime, cross_unit (формулы в ARCHITECTURE.md §4) |
| 3 | `backend/services/sankey_builder.py` | Граф потоков: связывание outputs→inputs по имени продукта, внешние узлы, потери (алгоритм в ARCHITECTURE.md §6) |
| 4 | `backend/services/aggregator.py` | Агрегации daily→weekly→monthly→yearly через pandas groupby |
| 5 | `backend/routers/upload.py` | POST /api/upload, GET /api/files |
| 6 | `backend/routers/units.py` | GET /api/units, GET /api/units/{code} |
| 7 | `backend/routers/analytics.py` | GET /api/analytics/overview, /daily, /weekly, /monthly, /yearly |
| 8 | `backend/routers/anomalies.py` | GET /api/anomalies (фильтры), GET /api/anomalies/summary |
| 9 | `backend/routers/sankey.py` | GET /api/sankey?date=...&type=measured|reconciled |
| 10 | `backend/routers/settings.py` | GET/PUT /api/settings/thresholds |
| 11 | `backend/main.py` | FastAPI app + CORS + lifespan (load_all) + роутеры |

### Frontend (React 18 + Vite + Tailwind)
| # | Файл | Что делает |
|---|------|------------|
| 1 | Setup | vite, react, tailwind, react-router-dom, @tanstack/react-query, recharts, d3-sankey, axios, lucide-react |
| 2 | `src/App.jsx` | Роутинг |
| 3 | `src/api/client.js` | axios baseURL=http://localhost:8000 |
| 4 | `src/components/Layout.jsx` | Sidebar + Header + Content |
| 5 | `src/components/Sidebar.jsx` | Навигация: Обзор, Установка, Аномалии, Потоки, Настройки, Загрузка |
| 6 | `src/components/KPICard.jsx` | Плашка: label + value + unit + trend |
| 7 | `src/components/StatusBadge.jsx` | Норма/Внимание/Критично/Простой |
| 8 | `src/components/ControlChart.jsx` | SPC: линия + зоны ±2σ/±3σ + цветные точки |
| 9 | `src/components/ReconGapChart.jsx` | Столбцы Δ% по дням |
| 10 | `src/components/CusumChart.jsx` | Линия CUSUM + порог H |
| 11 | `src/components/SankeyDiagram.jsx` | D3 Sankey потоков между установками |
| 12 | `src/components/EventLog.jsx` | Таблица аномалий |
| 13 | `src/pages/OverviewPage.jsx` | KPI + таблицы установок по цехам (wireframe в ARCHITECTURE.md §5.2) |
| 14 | `src/pages/UnitDetailPage.jsx` | KPI + 3 графика + табы (§5.3) |
| 15 | `src/pages/AnomaliesPage.jsx` | Сводка по методам + журнал (§5.4) |
| 16 | `src/pages/SankeyPage.jsx` | Sankey + таблица потерь (§5.5) |
| 17 | `src/pages/SettingsPage.jsx` | 6 слайдеров порогов (§5.6) |
| 18 | `src/pages/UploadPage.jsx` | Drag&drop загрузка |

### Deploy
| Файл | Что |
|------|-----|
| `requirements.txt` | fastapi uvicorn openpyxl pandas numpy python-multipart aiofiles |
| `frontend/package.json` | deps выше |
| `deploy/nginx.conf` | static + proxy |
| `deploy/refinery.service` | systemd |
| `.gitignore` | data/*.xlsm, node_modules, __pycache__, dist, .env |
| `start.sh` | Запуск dev |

## Стиль фронтенда
Тёмная тема: #050a18 фон, #0c1529 карточки, #1e293b границы, #e2e8f0 текст.
Акценты: #3b82f6 синий, #f59e0b жёлтый, #4ade80 зелёный, #f87171 красный.
Шрифт Inter. Иконки Lucide. Стиль как Titan/Thor audit dashboard.

## Критически важно
- **НЕ переписывай parser.py** — он работает и протестирован
- **Никакой БД** — только pandas in-memory
- Два потока: **измеренное** (приборы) и **согласованное** (отчёт)
- Согласованный дебаланс всегда = 0
- В примере 4 установки × 2 дня, в реале будет 18 × 31
- Тестируй backend через `python services/parser.py` и `/docs`

## Порядок
1. Backend целиком → проверить /docs
2. Frontend целиком
3. Deploy файлы
