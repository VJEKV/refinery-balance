"""6 детекторов аномалий."""
import numpy as np
from typing import Dict, List
from datetime import date


def detect_all(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """Запустить все 5 детекторов для одной установки."""
    anomalies = []
    anomalies.extend(balance_closure(unit_data, dates, thresholds))
    anomalies.extend(recon_gap(unit_data, dates, thresholds))
    anomalies.extend(spc(unit_data, dates, thresholds))
    anomalies.extend(downtime(unit_data, dates, thresholds))
    anomalies.extend(cross_unit_single(unit_data, dates, thresholds))
    return anomalies


def balance_closure(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.1 Невязка МБ."""
    results = []
    threshold = thresholds.get("balance_closure", 3.0)
    imb_rel = unit_data["summary"]["imbalance_rel"]["measured"]
    consumed_m = unit_data["summary"]["consumed"]["measured"]
    consumed_r = unit_data["summary"]["consumed"]["reconciled"]
    produced_m = unit_data["summary"]["produced"]["measured"]
    produced_r = unit_data["summary"]["produced"]["reconciled"]
    imb_m = unit_data["summary"]["imbalance"]["measured"]
    for i, d in enumerate(dates):
        if i >= len(imb_rel):
            break
        val = abs(imb_rel[i]) * 100
        if val > threshold:
            severity = "critical" if val > threshold * 2 else "warn"
            c_m = consumed_m[i] if i < len(consumed_m) else 0
            c_r = consumed_r[i] if i < len(consumed_r) else 0
            p_m = produced_m[i] if i < len(produced_m) else 0
            p_r = produced_r[i] if i < len(produced_r) else 0
            imb_val = imb_m[i] if i < len(imb_m) else 0
            results.append({
                "date": d.isoformat(),
                "method": "balance_closure",
                "description": f"Потери: разница вход/выход {val:.2f}% (допустимо {threshold}%)",
                "value": round(val, 2),
                "threshold": threshold,
                "severity": severity,
                "input_measured": round(c_m, 2),
                "input_reconciled": round(c_r, 2),
                "output_measured": round(p_m, 2),
                "output_reconciled": round(p_r, 2),
                "delta_tons": round(imb_val, 2),
                "delta_pct": round(val, 2),
            })
    return results


def recon_gap(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.2 Прибор vs Согласованное."""
    results = []
    threshold = thresholds.get("recon_gap", 5.0)
    consumed_m = unit_data["summary"]["consumed"]["measured"]
    consumed_r = unit_data["summary"]["consumed"]["reconciled"]
    produced_m = unit_data["summary"]["produced"]["measured"]
    produced_r = unit_data["summary"]["produced"]["reconciled"]
    for i, d in enumerate(dates):
        if i >= len(consumed_m) or i >= len(consumed_r):
            break
        m = consumed_m[i]
        r = consumed_r[i]
        if m == 0:
            continue
        gap = abs(m - r) / abs(m) * 100
        if gap > threshold:
            severity = "critical" if gap > threshold * 2 else "warn"
            p_m = produced_m[i] if i < len(produced_m) else 0
            p_r = produced_r[i] if i < len(produced_r) else 0
            results.append({
                "date": d.isoformat(),
                "method": "recon_gap",
                "description": f"Расхождение измерено/согласовано: {gap:.2f}% от измеренного (допустимо {threshold}%)",
                "value": round(gap, 2),
                "threshold": threshold,
                "severity": severity,
                "input_measured": round(m, 2),
                "input_reconciled": round(r, 2),
                "output_measured": round(p_m, 2),
                "output_reconciled": round(p_r, 2),
                "delta_tons": round(abs(m - r), 2),
                "delta_pct": round(gap, 2),
            })
    return results


def spc(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.3 Контрольные карты Шухарта."""
    results = []
    spc_sigma = thresholds.get("spc_sigma", 3.0)
    consumed = unit_data["summary"]["consumed"]["measured"]
    produced = unit_data["summary"]["produced"]["measured"]
    if len(consumed) < 2:
        return results
    arr = np.array(consumed, dtype=float)
    mu = np.mean(arr)
    sigma = np.std(arr, ddof=0)
    if sigma == 0:
        return results
    for i, d in enumerate(dates):
        if i >= len(consumed):
            break
        c = consumed[i]
        p = produced[i] if i < len(produced) else 0
        deviation = abs(c - mu) / sigma
        if deviation > spc_sigma:
            results.append({
                "date": d.isoformat(),
                "method": "spc",
                "description": f"Нетипичный день: отклонение {deviation:.2f}σ от среднего (допустимо {spc_sigma}σ)",
                "value": round(deviation, 2),
                "threshold": spc_sigma,
                "severity": "critical",
                "consumed": round(c, 2),
                "produced": round(p, 2),
                "mean": round(mu, 2),
                "sigma_val": round(sigma, 2),
            })
        elif deviation > spc_sigma - 1:
            results.append({
                "date": d.isoformat(),
                "method": "spc",
                "description": f"Приближение к границе нормы: {deviation:.2f}σ от среднего",
                "value": round(deviation, 2),
                "threshold": spc_sigma,
                "severity": "warn",
                "consumed": round(c, 2),
                "produced": round(p, 2),
                "mean": round(mu, 2),
                "sigma_val": round(sigma, 2),
            })
    return results


def cusum(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.4 CUSUM (Page's)."""
    results = []
    cusum_drift = thresholds.get("cusum_drift", 5.0)
    consumed = unit_data["summary"]["consumed"]["measured"]
    if len(consumed) < 2:
        return results
    arr = np.array(consumed, dtype=float)
    mu = np.mean(arr)
    if mu == 0:
        return results
    k = mu * 0.005
    H = mu * cusum_drift / 100
    s_plus = 0.0
    s_minus = 0.0
    for i, d in enumerate(dates):
        if i >= len(consumed):
            break
        x = consumed[i]
        s_plus = max(0, s_plus + (x - mu - k))
        s_minus = max(0, s_minus + (-x + mu - k))
        if s_plus > H or s_minus > H:
            results.append({
                "date": d.isoformat(),
                "method": "cusum",
                "description": f"Скрытый тренд: накопленное отклонение S+={s_plus:.1f}, S-={s_minus:.1f} (порог {H:.1f})",
                "value": round(max(s_plus, s_minus), 2),
                "threshold": round(H, 2),
                "severity": "critical",
            })
    return results


def downtime(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.5 Простои."""
    results = []
    downtime_pct = thresholds.get("downtime_pct", 10.0)
    # Absolute minimum: if both consumed and produced < 1 ton, treat as downtime
    ABS_MIN = 1.0
    consumed = unit_data["summary"]["consumed"]["measured"]
    produced = unit_data["summary"]["produced"]["measured"]
    # Use values above absolute minimum for meaningful average
    significant = [v for v in consumed if v >= ABS_MIN]
    mu = float(np.mean(significant)) if significant else 0
    for i, d in enumerate(dates):
        if i >= len(consumed):
            break
        c = consumed[i]
        p = produced[i] if i < len(produced) else 0
        # Full downtime: both consumed and produced below absolute minimum
        if c < ABS_MIN and p < ABS_MIN:
            results.append({
                "date": d.isoformat(),
                "method": "downtime",
                "description": f"Простой: вход {c:.1f} т, выход {p:.1f} т (< {ABS_MIN} т)",
                "value": round(c + p, 2),
                "threshold": ABS_MIN,
                "severity": "critical",
            })
        elif mu > 0 and c < mu * downtime_pct / 100:
            results.append({
                "date": d.isoformat(),
                "method": "downtime",
                "description": f"Простой: загрузка {c:.0f} т < {downtime_pct}% от среднего ({mu:.0f} т)",
                "value": round(c, 2),
                "threshold": round(mu * downtime_pct / 100, 2),
                "severity": "critical",
            })
        elif mu > 0 and c < mu * 0.5:
            results.append({
                "date": d.isoformat(),
                "method": "downtime",
                "description": f"Частичная загрузка: {c:.0f} т < 50% от среднего ({mu:.0f} т)",
                "value": round(c, 2),
                "threshold": round(mu * 0.5, 2),
                "severity": "warn",
            })
    return results


def cross_unit_single(unit_data: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.6 Межцеховой баланс — placeholder на уровне одной установки.
    Полный cross_unit требует данных всех установок, см. detect_cross_unit()."""
    return []


def detect_cross_unit(all_units: Dict, dates: List[date], thresholds: Dict) -> List[Dict]:
    """4.6 Межцеховой баланс — между установками."""
    results = []
    threshold = thresholds.get("cross_unit", 5.0)

    for d_idx, d in enumerate(dates):
        ds = d.strftime("%Y-%m-%d")
        outputs_map = {}
        inputs_map = {}

        for code, unit_info in all_units.items():
            unit_data = unit_info["data"]
            unit_dates = unit_info["dates"]
            if d not in unit_dates:
                continue
            local_idx = unit_dates.index(d)

            for direction, dmap in [("outputs", outputs_map), ("inputs", inputs_map)]:
                df = unit_data[direction]
                if df is None:
                    continue
                meas_col = f"{ds}_meas"
                if meas_col not in df.columns:
                    continue
                for _, row in df.iterrows():
                    product = row["product"]
                    val = row[meas_col]
                    if val and val > 0:
                        dmap.setdefault(product, []).append({
                            "unit": code,
                            "unit_name": unit_info["name"],
                            "value": val,
                        })

        for product, out_list in outputs_map.items():
            if product in inputs_map:
                for out_entry in out_list:
                    for in_entry in inputs_map[product]:
                        if out_entry["unit"] == in_entry["unit"]:
                            continue
                        out_val = out_entry["value"]
                        in_val = in_entry["value"]
                        if out_val == 0:
                            continue
                        loss = out_val - in_val
                        loss_pct = abs(loss) / out_val * 100
                        if loss_pct > threshold:
                            severity = "critical" if loss_pct > threshold * 2 else "warn"
                            results.append({
                                "date": d.isoformat(),
                                "method": "cross_unit",
                                "description": (
                                    f"Потери {product}: {out_entry['unit_name']} → {in_entry['unit_name']}, "
                                    f"Δ={loss:.1f} т ({loss_pct:.1f}%)"
                                ),
                                "value": round(loss_pct, 2),
                                "threshold": threshold,
                                "severity": severity,
                                "product": product,
                                "source_unit": out_entry["unit"],
                                "source_unit_name": out_entry["unit_name"],
                                "target_unit": in_entry["unit"],
                                "target_unit_name": in_entry["unit_name"],
                                "output_value": out_val,
                                "input_value": in_val,
                            })
    return results


def get_spc_data(unit_data: Dict, dates: List[date]) -> Dict:
    """Данные для SPC графика."""
    consumed = unit_data["summary"]["consumed"]["measured"]
    if len(consumed) < 2:
        return {"dates": [], "values": [], "mean": 0, "sigma": 0}
    arr = np.array(consumed, dtype=float)
    mu = float(np.mean(arr))
    sigma = float(np.std(arr, ddof=0))
    return {
        "dates": [d.isoformat() for d in dates[:len(consumed)]],
        "values": [float(v) for v in consumed],
        "mean": round(mu, 2),
        "sigma": round(sigma, 2),
    }


def get_cusum_data(unit_data: Dict, dates: List[date], thresholds: Dict) -> Dict:
    """Данные для CUSUM графика."""
    cusum_drift = thresholds.get("cusum_drift", 5.0)
    consumed = unit_data["summary"]["consumed"]["measured"]
    if len(consumed) < 2:
        return {"dates": [], "s_plus": [], "s_minus": [], "H": 0}
    arr = np.array(consumed, dtype=float)
    mu = float(np.mean(arr))
    if mu == 0:
        return {"dates": [], "s_plus": [], "s_minus": [], "H": 0}
    k = mu * 0.005
    H = mu * cusum_drift / 100
    s_plus_list = []
    s_minus_list = []
    sp = 0.0
    sm = 0.0
    for x in consumed:
        sp = max(0, sp + (x - mu - k))
        sm = max(0, sm + (-x + mu - k))
        s_plus_list.append(round(sp, 2))
        s_minus_list.append(round(sm, 2))
    return {
        "dates": [d.isoformat() for d in dates[:len(consumed)]],
        "s_plus": s_plus_list,
        "s_minus": s_minus_list,
        "H": round(H, 2),
        "mean": round(mu, 2),
    }


def get_recon_gap_data(unit_data: Dict, dates: List[date]) -> Dict:
    """Данные для ReconGap графика."""
    consumed_m = unit_data["summary"]["consumed"]["measured"]
    consumed_r = unit_data["summary"]["consumed"]["reconciled"]
    gaps = []
    gaps_tons = []
    for i in range(min(len(consumed_m), len(consumed_r))):
        m = consumed_m[i]
        r = consumed_r[i]
        if m == 0:
            gaps.append(0.0)
            gaps_tons.append(0.0)
        else:
            gaps.append(round(abs(m - r) / abs(m) * 100, 2))
            gaps_tons.append(round(abs(m - r), 2))
    return {
        "dates": [d.isoformat() for d in dates[:len(gaps)]],
        "gaps": gaps,
        "gaps_tons": gaps_tons,
    }
