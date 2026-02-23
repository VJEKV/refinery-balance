"""Per-product measured vs reconciled gap time series."""
from typing import Dict, List
from datetime import date


def get_product_recon_gaps(unit_data: Dict, dates: List[date]) -> Dict:
    """Return per-product recon gap data for charting.

    Returns:
        {
            "dates": ["2025-01-01", ...],
            "inputs": [
                {"product": "...", "gaps_pct": [...], "gaps_tons": [...], "measured": [...], "reconciled": [...]},
                ...
            ],
            "outputs": [...]
        }
    """
    date_strs = [d.isoformat() for d in dates]
    result = {"dates": date_strs, "inputs": [], "outputs": []}

    for direction in ("inputs", "outputs"):
        df = unit_data.get(direction)
        if df is None:
            continue

        for _, row in df.iterrows():
            product = row["product"]
            gaps_pct = []
            gaps_tons = []
            measured = []
            reconciled = []

            for d in dates:
                ds = d.strftime("%Y-%m-%d")
                meas_col = f"{ds}_meas"
                recon_col = f"{ds}_recon"
                m = float(row.get(meas_col, 0) or 0)
                r = float(row.get(recon_col, 0) or 0)
                measured.append(round(m, 2))
                reconciled.append(round(r, 2))
                if m == 0:
                    gaps_pct.append(0.0)
                    gaps_tons.append(0.0)
                else:
                    gaps_pct.append(round(abs(m - r) / abs(m) * 100, 2))
                    gaps_tons.append(round(abs(m - r), 2))

            # Only include products that have at least some non-zero data
            if any(v > 0 for v in measured) or any(v > 0 for v in reconciled):
                result[direction].append({
                    "product": product,
                    "gaps_pct": gaps_pct,
                    "gaps_tons": gaps_tons,
                    "measured": measured,
                    "reconciled": reconciled,
                })

    return result
