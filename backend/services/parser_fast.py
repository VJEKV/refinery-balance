"""
Быстрый парсер на python-calamine (Rust). Формат выхода идентичен parser.py.
Calamine читает .xlsm в 10-50 раз быстрее чем openpyxl.
"""
import pandas as pd
from python_calamine import CalamineWorkbook
from datetime import datetime, date
from typing import Dict, List
import os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import (
    SHEET_NAME, HEADER_DATE_ROW, DATA_START_COL,
    COL_UNIT, COL_FLOW_DIR, COL_PRODUCT, COL_PLAN_MONTH, COL_PLAN_DAY
)


def parse_report(filepath: str) -> Dict:
    """Парсинг отчёта через calamine. Выход идентичен parser.parse_report()."""
    wb = CalamineWorkbook.from_path(filepath)
    if SHEET_NAME not in wb.sheet_names:
        raise ValueError(f"Лист '{SHEET_NAME}' не найден. Есть: {wb.sheet_names}")
    rows = wb.get_sheet_by_name(SHEET_NAME).to_python()
    dates = _parse_dates(rows)
    units = _parse_unit_blocks(rows, dates)
    return {"filename": os.path.basename(filepath), "dates": dates, "units": units}


def _cell(rows, row_idx, col_idx):
    """Безопасное чтение ячейки (0-based row, 1-based col)."""
    if row_idx >= len(rows):
        return None
    row = rows[row_idx]
    ci = col_idx - 1  # calamine — 0-based
    if ci >= len(row):
        return None
    return row[ci]


def _parse_dates(rows) -> List[date]:
    dates = []
    col = DATA_START_COL
    ri = HEADER_DATE_ROW - 1  # 0-based
    if ri >= len(rows):
        return dates
    row = rows[ri]
    while True:
        ci = col - 1
        if ci >= len(row):
            break
        val = row[ci]
        if val is None:
            break
        if isinstance(val, datetime):
            dates.append(val.date())
        elif isinstance(val, date):
            dates.append(val)
        elif isinstance(val, str):
            for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
                try:
                    dates.append(datetime.strptime(val, fmt).date())
                    break
                except ValueError:
                    continue
        elif isinstance(val, (int, float)):
            # Excel serial date
            try:
                from datetime import timedelta
                d = datetime(1899, 12, 30) + timedelta(days=int(val))
                dates.append(d.date())
            except Exception:
                pass
        col += 2
    return dates


def _parse_unit_blocks(rows, dates: List[date]) -> Dict:
    units = {}
    num_days = len(dates)
    cur_unit = None
    cur_dir = None
    cur_prods = []

    for row_idx in range(len(rows)):
        f = _cell(rows, row_idx, COL_UNIT)
        g = _cell(rows, row_idx, COL_FLOW_DIR)
        h = _cell(rows, row_idx, COL_PRODUCT)

        if f and f != 'Потоки':
            f = str(f).strip()
            if cur_unit and cur_dir and cur_prods:
                _save(units, cur_unit, cur_dir, cur_prods, dates)
                cur_prods = []
            cur_unit = f
            if cur_unit not in units:
                units[cur_unit] = {
                    "inputs": None, "outputs": None,
                    "summary": {k: {"measured": [], "reconciled": []}
                                for k in ("consumed", "produced", "imbalance", "imbalance_rel")}
                }

        if g in ('Входящие', 'Исходящие'):
            if cur_unit and cur_dir and cur_prods:
                _save(units, cur_unit, cur_dir, cur_prods, dates)
                cur_prods = []
            cur_dir = g

        if g in ('Потреблено', 'Вырабатано', 'Дебаланс', 'Дебаланс отн.'):
            if cur_unit and cur_dir and cur_prods:
                _save(units, cur_unit, cur_dir, cur_prods, dates)
                cur_prods = []
                cur_dir = None
            if cur_unit and cur_unit in units:
                key = {'Потреблено': 'consumed', 'Вырабатано': 'produced',
                       'Дебаланс': 'imbalance', 'Дебаланс отн.': 'imbalance_rel'}.get(g)
                if key:
                    units[cur_unit]["summary"][key] = _read_days(rows, row_idx, num_days)
            continue

        if h and 'Суммарно' in str(h):
            if cur_unit and cur_dir and cur_prods:
                _save(units, cur_unit, cur_dir, cur_prods, dates)
                cur_prods = []
            continue

        if h and cur_unit and cur_dir:
            cur_prods.append({
                "product": str(h).strip(),
                "plan_month": _f(_cell(rows, row_idx, COL_PLAN_MONTH)),
                "plan_day": _f(_cell(rows, row_idx, COL_PLAN_DAY)),
                "days": _read_days(rows, row_idx, num_days),
            })

    if cur_unit and cur_dir and cur_prods:
        _save(units, cur_unit, cur_dir, cur_prods, dates)
    return units


def _read_days(rows, row_idx, num_days):
    m, r = [], []
    row = rows[row_idx] if row_idx < len(rows) else []
    for i in range(num_days):
        ci_m = DATA_START_COL - 1 + i * 2
        ci_r = DATA_START_COL - 1 + i * 2 + 1
        m.append(_f(row[ci_m] if ci_m < len(row) else None))
        r.append(_f(row[ci_r] if ci_r < len(row) else None))
    return {"measured": m, "reconciled": r}


def _save(units, unit, direction, products, dates):
    rows = []
    for p in products:
        row = {"product": p["product"], "plan_month": p["plan_month"], "plan_day": p["plan_day"]}
        for i, d in enumerate(dates):
            ds = d.strftime("%Y-%m-%d")
            row[f"{ds}_meas"] = p["days"]["measured"][i] if i < len(p["days"]["measured"]) else 0.0
            row[f"{ds}_recon"] = p["days"]["reconciled"][i] if i < len(p["days"]["reconciled"]) else 0.0
        rows.append(row)
    df = pd.DataFrame(rows)
    key = "inputs" if direction == "Входящие" else "outputs"
    if units[unit][key] is None:
        units[unit][key] = df
    else:
        units[unit][key] = pd.concat([units[unit][key], df], ignore_index=True)


def _f(val) -> float:
    if val is None:
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0
