"""GET /api/analytics/overview, /daily, /weekly, /monthly, /yearly"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.store import store
from services.anomaly import detect_all, detect_cross_unit
from services import aggregator
from config import DEFAULT_THRESHOLDS, THRESHOLDS_FILE
import json
import os

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _get_thresholds():
    if os.path.exists(THRESHOLDS_FILE):
        with open(THRESHOLDS_FILE) as f:
            return json.load(f)
    return DEFAULT_THRESHOLDS.copy()


@router.get("/overview")
def overview():
    thresholds = _get_thresholds()
    dates = store.dates
    if not dates:
        return {
            "total_in": 0, "total_out": 0, "imbalance": 0,
            "anomaly_count": 0, "downtime_count": 0,
            "units": [], "dates": [],
        }

    latest_date = dates[-1]
    ds = latest_date.strftime("%Y-%m-%d")

    total_in = 0
    total_out = 0
    total_imbalance = 0
    all_anomalies = []
    downtime_count = 0
    units_overview = []

    for code, unit_info in store.units.items():
        data = unit_info["data"]
        unit_dates = unit_info["dates"]
        if latest_date not in unit_dates:
            continue
        idx = unit_dates.index(latest_date)

        consumed_m = data["summary"]["consumed"]["measured"]
        consumed_r = data["summary"]["consumed"]["reconciled"]
        produced_m = data["summary"]["produced"]["measured"]
        produced_r = data["summary"]["produced"]["reconciled"]
        imb_m = data["summary"]["imbalance"]["measured"]
        imb_rel_m = data["summary"]["imbalance_rel"]["measured"]

        in_m = consumed_m[idx] if idx < len(consumed_m) else 0
        in_r = consumed_r[idx] if idx < len(consumed_r) else 0
        out_m = produced_m[idx] if idx < len(produced_m) else 0
        out_r = produced_r[idx] if idx < len(produced_r) else 0
        imb = imb_m[idx] if idx < len(imb_m) else 0
        imb_rel = imb_rel_m[idx] * 100 if idx < len(imb_rel_m) else 0
        recon_gap = abs(in_m - in_r) / abs(in_m) * 100 if in_m else 0

        total_in += in_m
        total_out += out_m
        total_imbalance += imb

        anomalies = detect_all(data, unit_dates, thresholds)
        all_anomalies.extend([{**a, "unit": code, "unit_name": unit_info["name"]} for a in anomalies])

        is_downtime = in_m == 0 and out_m == 0
        if is_downtime:
            downtime_count += 1

        unit_anomaly_count = len([a for a in anomalies if a["date"] == latest_date.isoformat()])

        # Status
        status = "normal"
        if is_downtime:
            status = "downtime"
        elif any(a["severity"] == "critical" and a["date"] == latest_date.isoformat() for a in anomalies):
            status = "critical"
        elif any(a["severity"] == "warn" and a["date"] == latest_date.isoformat() for a in anomalies):
            status = "warn"

        units_overview.append({
            "code": code,
            "name": unit_info["name"],
            "input_measured": round(in_m, 2),
            "input_reconciled": round(in_r, 2),
            "output_measured": round(out_m, 2),
            "output_reconciled": round(out_r, 2),
            "imbalance": round(imb, 2),
            "imbalance_pct": round(imb_rel, 2),
            "recon_gap_pct": round(recon_gap, 2),
            "anomaly_count": unit_anomaly_count,
            "is_downtime": is_downtime,
            "status": status,
        })

    cross_anomalies = detect_cross_unit(store.units, dates, thresholds)
    all_anomalies.extend(cross_anomalies)

    net_imbalance_pct = abs(total_imbalance) / total_in * 100 if total_in else 0

    return {
        "total_in": round(total_in, 2),
        "total_out": round(total_out, 2),
        "imbalance": round(net_imbalance_pct, 2),
        "anomaly_count": len(all_anomalies),
        "downtime_count": downtime_count,
        "units": units_overview,
        "dates": store.get_all_dates(),
        "latest_date": latest_date.isoformat(),
    }


@router.get("/daily")
def daily(unit: str, month: Optional[str] = None):
    u = store.get_unit(unit)
    if not u:
        raise HTTPException(404, "Установка не найдена")
    return aggregator.get_daily(u["data"], u["dates"], month)


@router.get("/weekly")
def weekly(unit: str, year: Optional[int] = None):
    u = store.get_unit(unit)
    if not u:
        raise HTTPException(404, "Установка не найдена")
    return aggregator.get_weekly(u["data"], u["dates"], year)


@router.get("/monthly")
def monthly(unit: str, year: Optional[int] = None):
    u = store.get_unit(unit)
    if not u:
        raise HTTPException(404, "Установка не найдена")
    return aggregator.get_monthly(u["data"], u["dates"], year)


@router.get("/yearly")
def yearly(unit: str):
    u = store.get_unit(unit)
    if not u:
        raise HTTPException(404, "Установка не найдена")
    return aggregator.get_yearly(u["data"], u["dates"])
