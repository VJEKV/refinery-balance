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
