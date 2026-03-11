"""GET /api/units, GET /api/units/{code}"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.store import store
from services.anomaly import (
    detect_all, get_spc_data, get_cusum_data, get_recon_gap_data
)
from services.product_recon import get_product_recon_gaps
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
def get_unit(
    code: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    unit = store.get_unit(code)
    if not unit:
        raise HTTPException(404, f"Установка '{code}' не найдена")

    thresholds = _get_thresholds()
    all_unit_dates = unit["dates"]
    data = unit["data"]

    # Apply date filter
    filtered = store.filter_dates(date_from, date_to, month)
    if filtered:
        dates = [d for d in filtered if d in all_unit_dates]
    else:
        dates = all_unit_dates
    anomalies = detect_all(data, dates, thresholds)

    series = store.get_unit_series(code)
    spc_data = get_spc_data(data, dates)
    cusum_data = get_cusum_data(data, dates, thresholds)
    recon_data = get_recon_gap_data(data, dates)

    # Products with totals over entire period
    products = {"inputs": [], "outputs": []}
    if dates:
        for direction in ("inputs", "outputs"):
            df = data.get(direction)
            if df is None:
                continue
            meas_cols = [f"{d.strftime('%Y-%m-%d')}_meas" for d in dates]
            recon_cols = [f"{d.strftime('%Y-%m-%d')}_recon" for d in dates]
            items = []
            for _, row in df.iterrows():
                total_m = sum(float(row.get(c, 0) or 0) for c in meas_cols if c in row.index)
                total_r = sum(float(row.get(c, 0) or 0) for c in recon_cols if c in row.index)
                items.append({
                    "product": row["product"],
                    "measured": round(total_m, 2),
                    "reconciled": round(total_r, 2),
                })
            grand_total_m = sum(p["measured"] for p in items)
            for p in items:
                p["share_pct"] = round(p["measured"] / grand_total_m * 100, 2) if grand_total_m else 0.0
                delta = p["measured"] - p["reconciled"]
                p["delta_tons"] = round(delta, 2)
                p["delta_pct"] = round(delta / p["reconciled"] * 100, 2) if p["reconciled"] else 0.0
            items.sort(key=lambda x: x["share_pct"], reverse=True)
            products[direction] = items

    # Per-product recon gap time series
    product_recon = get_product_recon_gaps(data, dates)

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
        "product_recon": product_recon,
        "anomalies": anomalies,
    }
