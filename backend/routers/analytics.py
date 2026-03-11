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
def overview(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    thresholds = _get_thresholds()
    filtered_dates = store.filter_dates(date_from, date_to, month)
    all_dates = store.dates

    if not all_dates:
        return {
            "total_in": 0, "total_out": 0, "imbalance": 0,
            "anomaly_count": 0, "downtime_count": 0,
            "units": [], "dates": [],
        }

    # Use filtered dates if available, otherwise all
    target_dates = filtered_dates if filtered_dates else all_dates

    total_in = 0
    total_out = 0
    total_imbalance = 0
    all_anomalies = []
    downtime_count = 0
    units_overview = []

    for code, unit_info in store.units.items():
        data = unit_info["data"]
        unit_dates = unit_info["dates"]

        # Find indices that match target dates
        indices = [i for i, d in enumerate(unit_dates) if d in target_dates]
        if not indices:
            continue

        consumed_m = data["summary"]["consumed"]["measured"]
        consumed_r = data["summary"]["consumed"]["reconciled"]
        produced_m = data["summary"]["produced"]["measured"]
        produced_r = data["summary"]["produced"]["reconciled"]
        imb_m = data["summary"]["imbalance"]["measured"]
        imb_rel_m = data["summary"]["imbalance_rel"]["measured"]

        # Aggregate over all matching days
        in_m = sum(consumed_m[i] for i in indices if i < len(consumed_m))
        in_r = sum(consumed_r[i] for i in indices if i < len(consumed_r))
        out_m = sum(produced_m[i] for i in indices if i < len(produced_m))
        out_r = sum(produced_r[i] for i in indices if i < len(produced_r))
        imb = sum(imb_m[i] for i in indices if i < len(imb_m))

        # Average imbalance_rel
        imb_rel_values = [imb_rel_m[i] * 100 for i in indices if i < len(imb_rel_m)]
        imb_rel = sum(imb_rel_values) / len(imb_rel_values) if imb_rel_values else 0

        recon_gap = abs(in_m - in_r) / abs(in_m) * 100 if in_m else 0

        # Plan execution: plan_month from DataFrames
        plan_in = 0.0
        plan_out = 0.0
        inputs_df = data.get("inputs")
        outputs_df = data.get("outputs")
        if inputs_df is not None and "plan_month" in inputs_df.columns:
            plan_in = float(inputs_df["plan_month"].sum())
        if outputs_df is not None and "plan_month" in outputs_df.columns:
            plan_out = float(outputs_df["plan_month"].sum())

        plan_pct_in = round(in_r / plan_in * 100, 2) if plan_in else 0.0
        plan_pct_out = round(out_r / plan_out * 100, 2) if plan_out else 0.0

        total_in += in_m
        total_out += out_m
        total_imbalance += imb

        anomalies = detect_all(data, unit_dates, thresholds)
        # Filter anomalies to target dates
        target_date_strs = {d.isoformat() for d in target_dates}
        anomalies = [a for a in anomalies if a["date"] in target_date_strs]
        all_anomalies.extend([{**a, "unit": code, "unit_name": unit_info["name"]} for a in anomalies])

        # Downtime: count days with near-zero input+output (< 1 ton each)
        ABS_MIN = 1.0
        dt_count = 0
        for i in indices:
            c = abs(consumed_m[i]) if i < len(consumed_m) else 0
            p = abs(produced_m[i]) if i < len(produced_m) else 0
            if c < ABS_MIN and p < ABS_MIN:
                dt_count += 1
        if dt_count > 0:
            downtime_count += dt_count

        is_downtime = (abs(in_m) < ABS_MIN and abs(out_m) < ABS_MIN) or (plan_in == 0 and plan_out == 0 and abs(in_r) < ABS_MIN)

        # Status based on plan execution + anomaly severity
        has_critical = any(a["severity"] == "critical" for a in anomalies)
        has_warn = any(a["severity"] == "warn" for a in anomalies)
        status = "normal"
        if is_downtime:
            status = "downtime"
        elif plan_pct_in < 80 or plan_pct_out < 80 or has_critical:
            status = "critical"
        elif plan_pct_in < 95 or plan_pct_out < 95 or has_warn:
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
            "anomaly_count": len(anomalies),
            "is_downtime": is_downtime,
            "downtime_days": dt_count,
            "status": status,
            "plan_input_tons": round(plan_in, 2),
            "fact_input_tons": round(in_r, 2),
            "plan_output_tons": round(plan_out, 2),
            "fact_output_tons": round(out_r, 2),
            "plan_pct_input": plan_pct_in,
            "plan_pct_output": plan_pct_out,
            "delta_input_tons": round(in_m - in_r, 2),
            "delta_input_pct": round((in_m - in_r) / in_r * 100, 2) if in_r else 0.0,
            "delta_output_tons": round(out_m - out_r, 2),
            "delta_output_pct": round((out_m - out_r) / out_r * 100, 2) if out_r else 0.0,
        })

    cross_anomalies = detect_cross_unit(store.units, target_dates, thresholds)
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
        "latest_date": all_dates[-1].isoformat() if all_dates else None,
    }


@router.get("/heatmap")
def heatmap(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    """Daily consumed/produced for all units — for heatmap visualization."""
    filtered_dates = store.filter_dates(date_from, date_to, month)
    target_dates = filtered_dates if filtered_dates else store.dates
    if not target_dates:
        return {"dates": [], "units": []}

    date_strs = [d.isoformat() for d in target_dates]
    units_data = []

    for code, unit_info in store.units.items():
        unit_dates = unit_info["dates"]
        data = unit_info["data"]
        consumed_m = data["summary"]["consumed"]["measured"]
        produced_m = data["summary"]["produced"]["measured"]

        consumed_vals = []
        produced_vals = []
        for d in target_dates:
            if d in unit_dates:
                idx = unit_dates.index(d)
                consumed_vals.append(round(consumed_m[idx], 2) if idx < len(consumed_m) else 0)
                produced_vals.append(round(produced_m[idx], 2) if idx < len(produced_m) else 0)
            else:
                consumed_vals.append(0)
                produced_vals.append(0)

        units_data.append({
            "code": code,
            "name": unit_info["name"],
            "consumed": consumed_vals,
            "produced": produced_vals,
        })

    return {"dates": date_strs, "units": units_data}


@router.get("/product-heatmap")
def product_heatmap(
    unit: str = Query(..., description="Unit code"),
    direction: str = Query("inputs", description="inputs or outputs"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
):
    """Per-product measured vs reconciled matrix for heatmap."""
    u = store.get_unit(unit)
    if not u:
        raise HTTPException(404, "Установка не найдена")
    if direction not in ("inputs", "outputs"):
        raise HTTPException(400, "direction must be 'inputs' or 'outputs'")

    unit_dates = u["dates"]
    filtered = store.filter_dates(date_from, date_to, month)
    target_dates = [d for d in (filtered if filtered else unit_dates) if d in unit_dates]
    if not target_dates:
        return {"products": [], "dates": [], "values": []}

    df = u["data"].get(direction)
    if df is None:
        return {"products": [], "dates": [], "values": []}

    date_strs = [d.isoformat() for d in target_dates]
    recon_cols = [f"{d.strftime('%Y-%m-%d')}_recon" for d in target_dates]
    products = []
    values = []
    share_pcts = []

    # First pass: collect totals for share calculation
    product_totals = []
    for _, row in df.iterrows():
        total_r = sum(float(row.get(c, 0) or 0) for c in recon_cols if c in row.index)
        product_totals.append(total_r)
    grand_total_r = sum(product_totals)

    for idx, (_, row) in enumerate(df.iterrows()):
        product_name = row["product"]
        row_data = []
        has_data = False
        for d in target_dates:
            ds = d.strftime("%Y-%m-%d")
            m = float(row.get(f"{ds}_meas", 0) or 0)
            r = float(row.get(f"{ds}_recon", 0) or 0)
            delta_pct = round(abs(m - r) / abs(m) * 100, 2) if m != 0 else 0.0
            row_data.append({
                "measured": round(m, 2),
                "reconciled": round(r, 2),
                "delta_tons": round(abs(m - r), 2),
                "delta_pct": delta_pct,
            })
            if m > 0 or r > 0:
                has_data = True
        if has_data:
            products.append(product_name)
            values.append(row_data)
            share = round(product_totals[idx] / grand_total_r * 100, 2) if grand_total_r else 0.0
            share_pcts.append(share)

    return {"products": products, "dates": date_strs, "values": values, "share_pcts": share_pcts}


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
