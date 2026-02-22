"""Конфигурация проекта"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

SHEET_NAME = "ОТЧЕТ_МБ"

# Строки шапки (1-based)
HEADER_DATE_ROW = 4
HEADER_TYPE_ROW = 5
DATA_START_COL = 11       # K = колонка 11

# Колонки (1-based)
COL_TAG = 1               # A — STL тег
COL_UNIT = 6              # F — Установка
COL_FLOW_DIR = 7          # G — Входящие/Исходящие/Потреблено/Вырабатано/Дебаланс/Дебаланс отн.
COL_PRODUCT = 8           # H — Продукт
COL_PLAN_MONTH = 9        # I — План месяц
COL_PLAN_DAY = 10         # J — План сутки

DEFAULT_THRESHOLDS = {
    "balance_closure": 3.0,
    "recon_gap": 5.0,
    "spc_sigma": 3.0,
    "cusum_drift": 5.0,
    "downtime_pct": 10.0,
    "cross_unit": 5.0,
}

THRESHOLDS_FILE = os.path.join(DATA_DIR, "thresholds.json")
