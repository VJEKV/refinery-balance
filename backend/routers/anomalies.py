"""GET /api/anomalies, GET /api/anomalies/summary"""
from fastapi import APIRouter, Query
from typing import Optional
import json
import os

from services.store import store
from services.anomaly import detect_all, detect_cross_unit
from config import DEFAULT_THRESHOLDS, THRESHOLDS_FILE

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


def _get_thresholds():
    if os.path.exists(THRESHOLDS_FILE):
        with open(THRESHOLDS_FILE) as f:
            return json.load(f)
    return DEFAULT_THRESHOLDS.copy()


def _collect_all_anomalies(date_from=None, date_to=None, month=None):
    thresholds = _get_thresholds()
    all_anomalies = []
    for code, unit_info in store.units.items():
        anomalies = detect_all(unit_info["data"], unit_info["dates"], thresholds)
        for a in anomalies:
            a["unit"] = code
            a["unit_name"] = unit_info["name"]
        all_anomalies.extend(anomalies)
    cross = detect_cross_unit(store.units, store.dates, thresholds)
    all_anomalies.extend(cross)

    # Apply date filtering
    if date_from or date_to or month:
        filtered_dates = store.filter_dates(date_from, date_to, month)
        date_strs = {d.isoformat() for d in filtered_dates}
        all_anomalies = [a for a in all_anomalies if a["date"] in date_strs]

    return all_anomalies


@router.get("")
def list_anomalies(
    unit: Optional[str] = None,
    method: Optional[str] = None,
    severity: Optional[str] = None,
    date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    anomalies = _collect_all_anomalies(date_from, date_to, month)
    if unit:
        anomalies = [a for a in anomalies if a.get("unit") == unit]
    if method:
        anomalies = [a for a in anomalies if a["method"] == method]
    if severity:
        anomalies = [a for a in anomalies if a["severity"] == severity]
    if date:
        anomalies = [a for a in anomalies if a["date"] == date]
    anomalies.sort(key=lambda a: (a["date"], a.get("unit", "")), reverse=True)
    return anomalies


@router.get("/downtime-details")
def downtime_details(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    """Расширенная аналитика простоев: данные за текущий и прошлые периоды."""
    import numpy as np

    thresholds = _get_thresholds()
    filtered_dates = store.filter_dates(date_from, date_to, month)
    target_dates = filtered_dates if filtered_dates else store.dates
    if not target_dates:
        return {"events": [], "unit_stats": []}

    target_set = set(target_dates)
    events = []
    unit_stats = []

    for code, unit_info in store.units.items():
        data = unit_info["data"]
        unit_dates = unit_info["dates"]
        consumed = data["summary"]["consumed"]["measured"]
        produced = data["summary"]["produced"]["measured"]

        # Средняя выработка за ВСЕ рабочие дни (базовый период)
        working_consumed = [consumed[i] for i, d in enumerate(unit_dates)
                           if i < len(consumed) and consumed[i] >= 1.0]
        working_produced = [produced[i] for i, d in enumerate(unit_dates)
                           if i < len(produced) and produced[i] >= 1.0]
        avg_consumed = float(np.mean(working_consumed)) if working_consumed else 0
        avg_produced = float(np.mean(working_produced)) if working_produced else 0

        downtime_days = []
        low_load_days = []

        for i, d in enumerate(unit_dates):
            if d not in target_set:
                continue
            if i >= len(consumed):
                break
            c = consumed[i]
            p = produced[i] if i < len(produced) else 0

            is_full_stop = c < 1.0 and p < 1.0
            is_low = avg_consumed > 0 and c < avg_consumed * 0.5

            if is_full_stop or is_low:
                lost_input = max(0, avg_consumed - c)
                lost_output = max(0, avg_produced - p)
                event = {
                    "date": d.isoformat(),
                    "unit": code,
                    "unit_name": unit_info["name"],
                    "type": "stop" if is_full_stop else "low_load",
                    "consumed": round(c, 1),
                    "produced": round(p, 1),
                    "avg_consumed": round(avg_consumed, 1),
                    "avg_produced": round(avg_produced, 1),
                    "lost_input_tons": round(lost_input, 1),
                    "lost_output_tons": round(lost_output, 1),
                    "load_pct": round(c / avg_consumed * 100, 1) if avg_consumed > 0 else 0,
                }
                events.append(event)
                if is_full_stop:
                    downtime_days.append(d)
                else:
                    low_load_days.append(d)

        if downtime_days or low_load_days:
            total_lost_input = sum(max(0, avg_consumed - consumed[unit_dates.index(d)])
                                   for d in downtime_days + low_load_days
                                   if d in unit_dates and unit_dates.index(d) < len(consumed))
            total_lost_output = sum(max(0, avg_produced - (produced[unit_dates.index(d)]
                                   if unit_dates.index(d) < len(produced) else 0))
                                   for d in downtime_days + low_load_days if d in unit_dates)
            unit_stats.append({
                "unit": code,
                "unit_name": unit_info["name"],
                "stop_days": len(downtime_days),
                "low_load_days": len(low_load_days),
                "avg_consumed": round(avg_consumed, 1),
                "avg_produced": round(avg_produced, 1),
                "total_lost_input": round(total_lost_input, 1),
                "total_lost_output": round(total_lost_output, 1),
            })

    events.sort(key=lambda e: (e["date"], e["unit"]))
    return {"events": events, "unit_stats": unit_stats}


@router.get("/summary")
def anomaly_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    anomalies = _collect_all_anomalies(date_from, date_to, month)
    methods = ["balance_closure", "recon_gap", "spc", "cusum", "downtime", "cross_unit"]
    summary = {}
    for m in methods:
        method_anomalies = [a for a in anomalies if a["method"] == m]
        summary[m] = {
            "total": len(method_anomalies),
            "critical": len([a for a in method_anomalies if a["severity"] == "critical"]),
            "warn": len([a for a in method_anomalies if a["severity"] == "warn"]),
        }
    return summary
