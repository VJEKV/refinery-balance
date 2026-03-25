"""GET /api/analytics/overview, /daily, /weekly, /monthly, /yearly"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.store import store
from services.anomaly import detect_all, detect_cross_unit
from services import aggregator
from config import DEFAULT_THRESHOLDS, THRESHOLDS_FILE
import json
import os
import numpy as np

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
    months: Optional[str] = None,
):
    thresholds = _get_thresholds()
    all_dates = store.dates
    has_filter = date_from or date_to or (month is not None) or months

    empty_response = {
        "total_in": 0, "total_out": 0, "imbalance": 0,
        "anomaly_count": 0, "downtime_count": 0,
        "units": [], "dates": [],
        "available_months": store.get_available_months(),
    }

    if not all_dates:
        return empty_response

    if has_filter:
        filtered_dates = store.filter_dates(date_from, date_to, month, months)
        if not filtered_dates:
            return empty_response
        target_dates = filtered_dates
    else:
        target_dates = all_dates

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

        # Plan execution: sum plan_monthly for months in filtered period
        target_unit_dates = [unit_dates[i] for i in indices]
        target_months = set(f"{d.year}-{d.month:02d}" for d in target_unit_dates)
        plan_monthly = unit_info.get("plan_monthly", {})
        plan_in = sum(plan_monthly.get(m, {}).get("input", 0) for m in target_months)
        plan_out = sum(plan_monthly.get(m, {}).get("output", 0) for m in target_months)

        # Fact = measured (измеренное)
        plan_pct_in = round(in_m / plan_in * 100, 2) if plan_in else 0.0
        plan_pct_out = round(out_m / plan_out * 100, 2) if plan_out else 0.0

        total_in += in_m
        total_out += out_m
        total_imbalance += imb

        anomalies = detect_all(data, unit_dates, thresholds)
        # Filter anomalies to target dates
        target_date_strs = {d.isoformat() for d in target_dates}
        anomalies = [a for a in anomalies if a["date"] in target_date_strs]
        all_anomalies.extend([{**a, "unit": code, "unit_name": unit_info["name"]} for a in anomalies])

        # Downtime: count days using threshold from settings
        ABS_MIN = 1.0
        downtime_pct = thresholds.get("downtime_pct", 10.0)
        # Норма = 75-й перцентиль рабочих дней (без простойных)
        significant_consumed = [consumed_m[i] for i in indices if i < len(consumed_m) and consumed_m[i] >= ABS_MIN]
        mu_consumed = float(np.percentile(significant_consumed, 75)) if significant_consumed else 0
        # Порог: снижение на downtime_pct% от нормы
        low_threshold = mu_consumed * (100 - downtime_pct) / 100
        dt_count = 0
        for i in indices:
            c = abs(consumed_m[i]) if i < len(consumed_m) else 0
            p = abs(produced_m[i]) if i < len(produced_m) else 0
            is_full_stop = c < ABS_MIN and p < ABS_MIN
            is_low = not is_full_stop and mu_consumed > 0 and c < low_threshold
            if is_full_stop or is_low:
                dt_count += 1
        if dt_count > 0:
            downtime_count += dt_count

        is_downtime = (abs(in_m) < ABS_MIN and abs(out_m) < ABS_MIN) or (plan_in == 0 and plan_out == 0 and abs(in_m) < ABS_MIN)

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
            "fact_input_tons": round(in_m, 2),
            "plan_output_tons": round(plan_out, 2),
            "fact_output_tons": round(out_m, 2),
            "plan_pct_input": plan_pct_in,
            "plan_pct_output": plan_pct_out,
            "delta_input_tons": round(in_r - in_m, 2),
            "delta_input_pct": round((in_r - in_m) / in_m * 100, 2) if in_m else 0.0,
            "delta_output_tons": round(out_r - out_m, 2),
            "delta_output_pct": round((out_r - out_m) / out_m * 100, 2) if out_m else 0.0,
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
        "dates": [d.isoformat() for d in target_dates],
        "all_dates": store.get_all_dates(),
        "available_months": store.get_available_months(),
        "latest_date": all_dates[-1].isoformat() if all_dates else None,
    }


@router.get("/heatmap")
def heatmap(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
    months: Optional[str] = None,
):
    """Daily consumed/produced for all units — for heatmap visualization."""
    has_filter = date_from or date_to or (month is not None) or months
    if has_filter:
        filtered_dates = store.filter_dates(date_from, date_to, month, months)
        target_dates = filtered_dates if filtered_dates else []
    else:
        target_dates = store.dates
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

        # Plan: sum plan_day across all products
        plan_day_input = 0.0
        plan_day_output = 0.0
        if data.get("inputs") is not None and "plan_day" in data["inputs"].columns:
            plan_day_input = float(data["inputs"]["plan_day"].sum())
        if data.get("outputs") is not None and "plan_day" in data["outputs"].columns:
            plan_day_output = float(data["outputs"]["plan_day"].sum())

        units_data.append({
            "code": code,
            "name": unit_info["name"],
            "consumed": consumed_vals,
            "produced": produced_vals,
            "plan_day_input": round(plan_day_input, 2),
            "plan_day_output": round(plan_day_output, 2),
        })

    return {"dates": date_strs, "units": units_data}


@router.get("/product-heatmap")
def product_heatmap(
    unit: str = Query(..., description="Unit code"),
    direction: str = Query("inputs", description="inputs or outputs"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
    months: Optional[str] = None,
):
    """Per-product measured vs reconciled matrix for heatmap."""
    u = store.get_unit(unit)
    if not u:
        raise HTTPException(404, "Установка не найдена")
    if direction not in ("inputs", "outputs"):
        raise HTTPException(400, "direction must be 'inputs' or 'outputs'")

    unit_dates = u["dates"]
    has_filter = date_from or date_to or (month is not None) or months
    if has_filter:
        filtered = store.filter_dates(date_from, date_to, month, months)
        target_dates = [d for d in filtered if d in unit_dates]
    else:
        target_dates = unit_dates
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
            delta_pct = round((r - m) / abs(m) * 100, 2) if m != 0 else 0.0
            row_data.append({
                "measured": round(m, 2),
                "reconciled": round(r, 2),
                "delta_tons": round(r - m, 2),
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


@router.get("/plan-fact")
def plan_fact(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
    months: Optional[str] = None,
):
    """Monthly plan vs fact breakdown: units in rows, months in columns."""
    all_dates = store.dates
    if not all_dates:
        return {"months": [], "units": [], "totals": {}}

    has_filter = date_from or date_to or (month is not None) or months
    target_dates = store.filter_dates(date_from, date_to, month, months) if has_filter else all_dates
    if not target_dates:
        return {"months": [], "units": [], "totals": {}}

    # Collect all months present in target_dates
    month_keys = sorted(set(f"{d.year}-{d.month:02d}" for d in target_dates))

    units_result = []
    for code, unit_info in store.units.items():
        data = unit_info["data"]
        unit_dates = unit_info["dates"]
        plan_monthly = unit_info.get("plan_monthly", {})
        consumed_m = data["summary"]["consumed"]["measured"]
        produced_m = data["summary"]["produced"]["measured"]

        monthly_data = {}
        for mk in month_keys:
            y, m = int(mk[:4]), int(mk[5:])
            indices = [i for i, d in enumerate(unit_dates) if d.year == y and d.month == m and d in set(target_dates)]
            fact_in = sum(consumed_m[i] for i in indices if i < len(consumed_m))
            fact_out = sum(produced_m[i] for i in indices if i < len(produced_m))
            plan_in = plan_monthly.get(mk, {}).get("input", 0)
            plan_out = plan_monthly.get(mk, {}).get("output", 0)
            pct_in = round(fact_in / plan_in * 100, 1) if plan_in else 0
            pct_out = round(fact_out / plan_out * 100, 1) if plan_out else 0

            # Daily breakdown for expandable rows
            days = []
            month_dates = sorted([d for d in unit_dates if d.year == y and d.month == m and d in set(target_dates)])
            plan_day_in = round(plan_in / len(month_dates), 2) if month_dates and plan_in else 0
            plan_day_out = round(plan_out / len(month_dates), 2) if month_dates and plan_out else 0
            for d in month_dates:
                idx = unit_dates.index(d)
                day_fact_in = round(consumed_m[idx], 2) if idx < len(consumed_m) else 0
                day_fact_out = round(produced_m[idx], 2) if idx < len(produced_m) else 0
                days.append({
                    "date": d.isoformat(),
                    "plan_in": plan_day_in,
                    "fact_in": day_fact_in,
                    "plan_out": plan_day_out,
                    "fact_out": day_fact_out,
                })

            monthly_data[mk] = {
                "plan_in": round(plan_in, 2),
                "fact_in": round(fact_in, 2),
                "plan_out": round(plan_out, 2),
                "fact_out": round(fact_out, 2),
                "pct_in": pct_in,
                "pct_out": pct_out,
                "days": days,
            }

        # Totals for this unit
        total_plan_in = sum(monthly_data[mk]["plan_in"] for mk in month_keys)
        total_fact_in = sum(monthly_data[mk]["fact_in"] for mk in month_keys)
        total_plan_out = sum(monthly_data[mk]["plan_out"] for mk in month_keys)
        total_fact_out = sum(monthly_data[mk]["fact_out"] for mk in month_keys)

        units_result.append({
            "code": code,
            "name": unit_info["name"],
            "months": monthly_data,
            "total_plan_in": round(total_plan_in, 2),
            "total_fact_in": round(total_fact_in, 2),
            "total_plan_out": round(total_plan_out, 2),
            "total_fact_out": round(total_fact_out, 2),
            "total_pct_in": round(total_fact_in / total_plan_in * 100, 1) if total_plan_in else 0,
            "total_pct_out": round(total_fact_out / total_plan_out * 100, 1) if total_plan_out else 0,
        })

    return {"months": month_keys, "units": units_result}


@router.get("/corrections")
def corrections(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[int] = None,
    months: Optional[str] = None,
):
    """Aggregated product corrections across all units."""
    from services.product_recon import get_product_recon_gaps

    all_dates = store.dates
    if not all_dates:
        return {"products": []}

    has_filter = date_from or date_to or (month is not None) or months
    target_dates = store.filter_dates(date_from, date_to, month, months) if has_filter else all_dates
    if not target_dates:
        return {"products": []}

    target_set = set(target_dates)
    # Aggregate: product -> list of correction events
    product_map = {}  # product_name -> {events: [...], sum_delta, ...}

    for code, unit_info in store.units.items():
        unit_dates = unit_info["dates"]
        filtered_unit_dates = [d for d in unit_dates if d in target_set]
        if not filtered_unit_dates:
            continue
        recon = get_product_recon_gaps(unit_info["data"], filtered_unit_dates)

        for direction in ("inputs", "outputs"):
            dir_label = "Сырьё" if direction == "inputs" else "Продукция"
            for prod_data in recon[direction]:
                product = prod_data["product"]
                key = product
                if key not in product_map:
                    product_map[key] = {"product": product, "events": [], "direction": dir_label}

                for i, d_str in enumerate(recon["dates"]):
                    m = prod_data["measured"][i]
                    r = prod_data["reconciled"][i]
                    gap_pct = prod_data["gaps_pct"][i]
                    gap_tons = prod_data["gaps_tons"][i]
                    if m > 0 or r > 0:
                        product_map[key]["events"].append({
                            "date": d_str,
                            "measured": m,
                            "reconciled": r,
                            "delta_tons": round(r - m, 2),
                            "delta_pct": round((r - m) / m * 100, 2) if m else 0,
                            "abs_delta_pct": gap_pct,
                            "unit_code": code,
                            "unit_name": unit_info["name"],
                        })

    # Build response
    products = []
    for key, pdata in product_map.items():
        events = pdata["events"]
        if not events:
            continue
        abs_deltas = [abs(e["delta_pct"]) for e in events]
        avg_delta_tons = sum(e["delta_tons"] for e in events) / len(events) if events else 0
        max_delta_pct = max(abs_deltas) if abs_deltas else 0
        products.append({
            "product": pdata["product"],
            "direction": pdata["direction"],
            "total_events": len(events),
            "avg_delta_tons": round(avg_delta_tons, 2),
            "max_delta_pct": round(max_delta_pct, 2),
            "events": sorted(events, key=lambda e: abs(e["delta_pct"]), reverse=True),
        })

    products.sort(key=lambda p: p["total_events"], reverse=True)
    return {"products": products}
