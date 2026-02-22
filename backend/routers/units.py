"""GET /api/units, GET /api/units/{code}"""
from fastapi import APIRouter, HTTPException

from services.store import store
from services.anomaly import (
    detect_all, get_spc_data, get_cusum_data, get_recon_gap_data
)
from config import DEFAULT_THRESHOLDS, THRESHOLDS_FILE
import json
import os

router = APIRouter(prefix="/api", tags=["units"])


def _get_thresholds():
    if os.path.exists(THRESHOLDS_FILE):
        with open(THRESHOLDS_FILE) as f:
            return json.load(f)
    return DEFAULT_THRESHOLDS.copy()


@router.get("/units")
def list_units():
    return store.get_unit_names()


@router.get("/units/{code}")
def get_unit(code: str):
    unit = store.get_unit(code)
    if not unit:
        raise HTTPException(404, f"Установка '{code}' не найдена")

    thresholds = _get_thresholds()
    dates = unit["dates"]
    data = unit["data"]
    anomalies = detect_all(data, dates, thresholds)

    series = store.get_unit_series(code)
    spc_data = get_spc_data(data, dates)
    cusum_data = get_cusum_data(data, dates, thresholds)
    recon_data = get_recon_gap_data(data, dates)

    # Products for latest date
    products = {"inputs": [], "outputs": []}
    if dates:
        latest = dates[-1]
        daily = store.get_unit_daily(code, latest)
        if daily:
            products["inputs"] = daily.get("inputs", [])
            products["outputs"] = daily.get("outputs", [])

    # Summary stats
    summary = data["summary"]
    consumed_m = summary["consumed"]["measured"]
    consumed_r = summary["consumed"]["reconciled"]
    produced_r = summary["produced"]["reconciled"]
    imb_rel_m = summary["imbalance_rel"]["measured"]

    latest_idx = len(dates) - 1 if dates else 0
    total_in_m = consumed_m[latest_idx] if latest_idx < len(consumed_m) else 0
    total_in_r = consumed_r[latest_idx] if latest_idx < len(consumed_r) else 0
    total_out_r = produced_r[latest_idx] if latest_idx < len(produced_r) else 0
    imbalance = imb_rel_m[latest_idx] * 100 if latest_idx < len(imb_rel_m) else 0
    recon_gap_val = abs(total_in_m - total_in_r) / abs(total_in_m) * 100 if total_in_m else 0

    return {
        "code": code,
        "name": unit["name"],
        "dates": [d.isoformat() for d in dates],
        "kpi": {
            "input_measured": round(total_in_m, 2),
            "input_reconciled": round(total_in_r, 2),
            "output_reconciled": round(total_out_r, 2),
            "imbalance_pct": round(imbalance, 2),
            "recon_gap_pct": round(recon_gap_val, 2),
            "anomaly_count": len(anomalies),
        },
        "series": series,
        "spc": spc_data,
        "cusum": cusum_data,
        "recon_gap": recon_data,
        "products": products,
        "anomalies": anomalies,
    }
