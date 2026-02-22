"""Агрегации daily → weekly → monthly → yearly через pandas."""
import pandas as pd
from typing import Dict, List, Optional
from datetime import date


def _build_daily_df(unit_data: Dict, dates: List[date]) -> pd.DataFrame:
    """Построить DataFrame суточных данных для одной установки."""
    records = []
    summary = unit_data["summary"]
    for i, d in enumerate(dates):
        rec = {"date": pd.Timestamp(d)}
        for key in ("consumed", "produced", "imbalance", "imbalance_rel"):
            for stream in ("measured", "reconciled"):
                vals = summary[key][stream]
                rec[f"{key}_{stream}"] = vals[i] if i < len(vals) else 0.0
        records.append(rec)
    df = pd.DataFrame(records)
    if not df.empty:
        df = df.set_index("date")
    return df


def get_daily(unit_data: Dict, dates: List[date], month: Optional[str] = None) -> List[Dict]:
    """Суточные данные, опционально фильтр по месяцу (YYYY-MM)."""
    df = _build_daily_df(unit_data, dates)
    if df.empty:
        return []
    if month:
        df = df[df.index.strftime("%Y-%m") == month]
    records = []
    for dt, row in df.iterrows():
        rec = {"date": dt.strftime("%Y-%m-%d")}
        for col in df.columns:
            rec[col] = round(float(row[col]), 4)
        records.append(rec)
    return records


def get_weekly(unit_data: Dict, dates: List[date], year: Optional[int] = None) -> List[Dict]:
    """Недельные агрегации."""
    df = _build_daily_df(unit_data, dates)
    if df.empty:
        return []
    if year:
        df = df[df.index.year == year]
    weekly = df.resample("W").agg({
        "consumed_measured": "sum",
        "consumed_reconciled": "sum",
        "produced_measured": "sum",
        "produced_reconciled": "sum",
        "imbalance_measured": "sum",
        "imbalance_reconciled": "sum",
        "imbalance_rel_measured": "mean",
        "imbalance_rel_reconciled": "mean",
    })
    records = []
    for dt, row in weekly.iterrows():
        rec = {"week_end": dt.strftime("%Y-%m-%d")}
        for col in weekly.columns:
            rec[col] = round(float(row[col]), 4)
        records.append(rec)
    return records


def get_monthly(unit_data: Dict, dates: List[date], year: Optional[int] = None) -> List[Dict]:
    """Месячные агрегации."""
    df = _build_daily_df(unit_data, dates)
    if df.empty:
        return []
    if year:
        df = df[df.index.year == year]
    monthly = df.resample("ME").agg({
        "consumed_measured": "sum",
        "consumed_reconciled": "sum",
        "produced_measured": "sum",
        "produced_reconciled": "sum",
        "imbalance_measured": "sum",
        "imbalance_reconciled": "sum",
        "imbalance_rel_measured": "mean",
        "imbalance_rel_reconciled": "mean",
    })
    records = []
    for dt, row in monthly.iterrows():
        rec = {"month": dt.strftime("%Y-%m")}
        for col in monthly.columns:
            rec[col] = round(float(row[col]), 4)
        records.append(rec)
    return records


def get_yearly(unit_data: Dict, dates: List[date]) -> List[Dict]:
    """Годовые агрегации."""
    df = _build_daily_df(unit_data, dates)
    if df.empty:
        return []
    yearly = df.resample("YE").agg({
        "consumed_measured": "sum",
        "consumed_reconciled": "sum",
        "produced_measured": "sum",
        "produced_reconciled": "sum",
        "imbalance_measured": "sum",
        "imbalance_reconciled": "sum",
        "imbalance_rel_measured": "mean",
        "imbalance_rel_reconciled": "mean",
    })
    records = []
    for dt, row in yearly.iterrows():
        rec = {"year": dt.year}
        for col in yearly.columns:
            rec[col] = round(float(row[col]), 4)
        records.append(rec)
    return records
