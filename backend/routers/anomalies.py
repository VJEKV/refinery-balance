"""GET /api/anomalies, GET /api/anomalies/summary, GET /api/anomalies/downtime-details"""
from fastapi import APIRouter, Query
from typing import Optional
import json
import os
import numpy as np

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


def _group_consecutive_days(days):
    """Группирует последовательные даты в события (начало, конец, дней)."""
    if not days:
        return []
    sorted_days = sorted(days, key=lambda x: x["date"])
    groups = []
    current = [sorted_days[0]]
    for i in range(1, len(sorted_days)):
        prev_date = current[-1]["date_obj"]
        curr_date = sorted_days[i]["date_obj"]
        if (curr_date - prev_date).days <= 1:
            current.append(sorted_days[i])
        else:
            groups.append(current)
            current = [sorted_days[i]]
    groups.append(current)
    return groups


@router.get("/downtime-details")
def downtime_details(
    unit: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    """Расширенная аналитика простоев: события с началом, концом, днями, обоснованием."""
    thresholds = _get_thresholds()
    has_filter = date_from or date_to or (month is not None)
    if has_filter:
        filtered_dates = store.filter_dates(date_from, date_to, month)
        target_dates = filtered_dates if filtered_dates else []
    else:
        target_dates = store.dates
    if not target_dates:
        return {"events": [], "unit_stats": []}

    target_set = set(target_dates)
    all_day_events = []
    unit_stats = []

    units_to_process = store.units.items()
    if unit:
        units_to_process = [(k, v) for k, v in units_to_process if k == unit]

    downtime_pct = thresholds.get("downtime_pct", 10.0)
    ABS_MIN = 1.0

    for code, unit_info in units_to_process:
        data = unit_info["data"]
        unit_dates = unit_info["dates"]
        consumed = data["summary"]["consumed"]["measured"]
        produced = data["summary"]["produced"]["measured"]

        # Средняя выработка за рабочие дни
        working_consumed = [consumed[i] for i, d in enumerate(unit_dates)
                           if i < len(consumed) and consumed[i] >= ABS_MIN]
        working_produced = [produced[i] for i, d in enumerate(unit_dates)
                           if i < len(produced) and produced[i] >= ABS_MIN]
        avg_consumed = float(np.mean(working_consumed)) if working_consumed else 0
        avg_produced = float(np.mean(working_produced)) if working_produced else 0

        day_events = []
        for i, d in enumerate(unit_dates):
            if d not in target_set:
                continue
            if i >= len(consumed):
                break
            c = consumed[i]
            p = produced[i] if i < len(produced) else 0

            is_full_stop = c < ABS_MIN and p < ABS_MIN
            is_low = not is_full_stop and avg_consumed > 0 and c < avg_consumed * downtime_pct / 100

            if is_full_stop or is_low:
                load_pct = round(c / avg_consumed * 100, 1) if avg_consumed > 0 else 0
                day_events.append({
                    "date_obj": d,
                    "date": d.isoformat(),
                    "unit": code,
                    "unit_name": unit_info["name"],
                    "type": "stop" if is_full_stop else "low_load",
                    "consumed": round(c, 1),
                    "produced": round(p, 1),
                    "load_pct": load_pct,
                })

        # Группировка в события
        groups = _group_consecutive_days(day_events)
        for group in groups:
            start = group[0]
            end = group[-1]
            days_count = len(group)
            total_lost_input = sum(max(0, avg_consumed - e["consumed"]) for e in group)
            total_lost_output = sum(max(0, avg_produced - e["produced"]) for e in group)
            avg_load = sum(e["load_pct"] for e in group) / days_count

            # Определяем тип события
            stop_days = sum(1 for e in group if e["type"] == "stop")
            event_type = "stop" if stop_days > days_count / 2 else "low_load"

            # Обоснование
            if event_type == "stop":
                if days_count == 1:
                    reason = f"Полная остановка: загрузка {start['consumed']} т, выпуск {start['produced']} т (при норме {avg_consumed:.0f} т/день)"
                else:
                    reason = f"Полная остановка {days_count} дн.: загрузка и выпуск близки к нулю (при норме {avg_consumed:.0f} т/день)"
            else:
                reason = f"Сниженная загрузка ({avg_load:.0f}% от нормы): среднее поступление {sum(e['consumed'] for e in group)/days_count:.0f} т/день вместо {avg_consumed:.0f} т/день"

            avg_event_consumed = sum(e["consumed"] for e in group) / days_count
            avg_event_produced = sum(e["produced"] for e in group) / days_count

            all_day_events.append({
                "unit": code,
                "unit_name": unit_info["name"],
                "start_date": start["date"],
                "end_date": end["date"],
                "days": days_count,
                "type": event_type,
                "avg_load_pct": round(avg_load, 1),
                "fact_input": round(avg_event_consumed, 1),
                "fact_output": round(avg_event_produced, 1),
                "norm_input": round(avg_consumed, 1),
                "norm_output": round(avg_produced, 1),
                "lost_input_tons": round(total_lost_input, 1),
                "lost_output_tons": round(total_lost_output, 1),
                "reason": reason,
            })

        # Статистика по установке
        if day_events:
            stop_count = sum(1 for e in day_events if e["type"] == "stop")
            low_count = sum(1 for e in day_events if e["type"] == "low_load")
            total_lost_in = sum(max(0, avg_consumed - e["consumed"]) for e in day_events)
            total_lost_out = sum(max(0, avg_produced - e["produced"]) for e in day_events)
            unit_stats.append({
                "unit": code,
                "unit_name": unit_info["name"],
                "stop_days": stop_count,
                "low_load_days": low_count,
                "total_events": len(groups),
                "avg_consumed": round(avg_consumed, 1),
                "avg_produced": round(avg_produced, 1),
                "total_lost_input": round(total_lost_in, 1),
                "total_lost_output": round(total_lost_out, 1),
            })

    all_day_events.sort(key=lambda e: (e["start_date"], e["unit"]))
    return {"events": all_day_events, "unit_stats": unit_stats}


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
