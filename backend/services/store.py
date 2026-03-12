"""DataStore — загрузка всех .xlsm в RAM через parser_fast (calamine)."""
import os
import glob
import re
from datetime import date
from typing import Dict, List, Optional

from config import DATA_DIR

# Быстрый парсер (Rust/calamine), fallback на openpyxl
try:
    from services.parser_fast import parse_report
    print("Парсер: python-calamine (быстрый)")
except ImportError:
    from services.parser import parse_report
    print("Парсер: openpyxl (медленный, установите python-calamine)")


class DataStore:
    def __init__(self):
        self.files: List[Dict] = []
        self.units: Dict = {}
        self.dates: List[date] = []
        self._file_meta: List[Dict] = []

    def load_all(self):
        """Загрузить все .xlsm из DATA_DIR."""
        import time
        start = time.time()
        self.files = []
        self.units = {}
        self.dates = []
        self._file_meta = []

        pattern = os.path.join(DATA_DIR, "*.xlsm")
        paths = sorted(glob.glob(pattern))
        for i, path in enumerate(paths):
            t0 = time.time()
            try:
                report = parse_report(path)
                self._add_report(report)
                print(f"  [{i+1}/{len(paths)}] {report['filename']} — {time.time()-t0:.1f}с")
            except Exception as e:
                print(f"  Ошибка загрузки {path}: {e}")

        self.dates.sort()
        print(f"Загрузка завершена за {time.time()-start:.1f}с")

    def add_file(self, filepath: str):
        """Загрузить один новый файл без перечитывания остальных."""
        import time
        t0 = time.time()
        report = parse_report(filepath)
        self._add_report(report)
        self.dates.sort()
        print(f"Добавлен {report['filename']} за {time.time()-t0:.1f}с")

    def _add_report(self, report):
        """Добавить распарсенный отчёт в хранилище."""
        self.files.append(report)
        self._file_meta.append({
            "filename": report["filename"],
            "dates": [d.isoformat() for d in report["dates"]],
            "units": list(report["units"].keys()),
            "period": f"{report['dates'][0].isoformat()} — {report['dates'][-1].isoformat()}" if report["dates"] else "",
        })
        for d in report["dates"]:
            if d not in self.dates:
                self.dates.append(d)
        # Determine month key from file dates (each file = 1 month)
        file_month_key = None
        if report["dates"]:
            d0 = report["dates"][0]
            file_month_key = f"{d0.year}-{d0.month:02d}"

        for unit_name, unit_data in report["units"].items():
            code = self._make_code(unit_name)

            # Compute plan totals for this file's month
            plan_for_month = self._calc_plan_month(unit_data, file_month_key)

            if code not in self.units:
                self.units[code] = {
                    "code": code,
                    "name": unit_name,
                    "data": unit_data,
                    "dates": list(report["dates"]),
                    "plan_monthly": plan_for_month,
                }
            else:
                existing = self.units[code]
                for d in report["dates"]:
                    if d not in existing["dates"]:
                        existing["dates"].append(d)
                existing["plan_monthly"].update(plan_for_month)
                self._merge_unit(existing["data"], unit_data, report["dates"])

    def _make_code(self, name: str) -> str:
        cleaned = re.sub(r'[^\w\s]', '', name)
        parts = cleaned.split()
        code = "_".join(parts[:3]).lower()
        return code or name[:20].lower().replace(" ", "_")

    def _calc_plan_month(self, unit_data: Dict, month_key: str) -> Dict:
        """Calculate plan totals for a single month from parsed unit data."""
        result = {}
        if not month_key:
            return result
        plan_in = 0.0
        plan_out = 0.0
        if unit_data.get("inputs") is not None and "plan_month" in unit_data["inputs"].columns:
            plan_in = float(unit_data["inputs"]["plan_month"].sum())
        if unit_data.get("outputs") is not None and "plan_month" in unit_data["outputs"].columns:
            plan_out = float(unit_data["outputs"]["plan_month"].sum())
        result[month_key] = {"input": plan_in, "output": plan_out}
        return result

    def _merge_unit(self, existing, new_data, new_dates):
        """Объединение данных установки из нескольких файлов.

        Для DataFrame (inputs/outputs): группируем по product,
        сливая дат-колонки из разных файлов в одну строку.
        Для summary: просто дописываем новые значения в конец списков.
        """
        import pandas as pd
        for key in ("inputs", "outputs"):
            if new_data[key] is not None:
                if existing[key] is None:
                    existing[key] = new_data[key]
                else:
                    combined = pd.concat([existing[key], new_data[key]], ignore_index=True)
                    # Группируем по product: для plan берём max,
                    # для дат-колонок берём first non-NaN (каждый файл заполняет свои даты)
                    agg_dict = {}
                    for col in combined.columns:
                        if col == "product":
                            continue
                        elif col in ("plan_month", "plan_day"):
                            agg_dict[col] = "max"
                        else:
                            agg_dict[col] = "first"
                    existing[key] = (
                        combined
                        .groupby("product", sort=False)
                        .agg(agg_dict)
                        .reset_index()
                        .fillna(0.0)
                    )
        for summary_key in ("consumed", "produced", "imbalance", "imbalance_rel"):
            for stream in ("measured", "reconciled"):
                existing["summary"][summary_key][stream].extend(
                    new_data["summary"][summary_key][stream]
                )

    def get_file_list(self) -> List[Dict]:
        return self._file_meta

    def get_unit_names(self) -> List[Dict]:
        return [{"code": v["code"], "name": v["name"]} for v in self.units.values()]

    def get_unit(self, code: str) -> Optional[Dict]:
        return self.units.get(code)

    def get_unit_daily(self, code: str, date_obj: date) -> Optional[Dict]:
        unit = self.units.get(code)
        if not unit:
            return None
        dates = unit["dates"]
        if date_obj not in dates:
            return None
        idx = dates.index(date_obj)
        result = {
            "date": date_obj.isoformat(),
            "unit": unit["name"],
            "code": code,
        }
        for key in ("consumed", "produced", "imbalance", "imbalance_rel"):
            m = unit["data"]["summary"][key]["measured"]
            r = unit["data"]["summary"][key]["reconciled"]
            result[key] = {
                "measured": m[idx] if idx < len(m) else 0.0,
                "reconciled": r[idx] if idx < len(r) else 0.0,
            }
        ds = date_obj.strftime("%Y-%m-%d")
        for direction in ("inputs", "outputs"):
            df = unit["data"][direction]
            if df is not None and f"{ds}_meas" in df.columns:
                prods = []
                for _, row in df.iterrows():
                    m = row.get(f"{ds}_meas", 0.0)
                    r = row.get(f"{ds}_recon", 0.0)
                    # Защита от NaN (может остаться после merge)
                    import math
                    if isinstance(m, float) and math.isnan(m):
                        m = 0.0
                    if isinstance(r, float) and math.isnan(r):
                        r = 0.0
                    prods.append({
                        "product": row["product"],
                        "measured": m,
                        "reconciled": r,
                    })
                result[direction] = prods
            else:
                result[direction] = []
        return result

    def get_all_dates(self) -> List[str]:
        return [d.isoformat() for d in self.dates]

    def extract_filtered_data(self, unit_data: Dict, all_dates: List[date], target_dates: List[date]) -> Dict:
        """Extract summary data for target_dates with proper index alignment."""
        target_set = set(target_dates)
        indices = [i for i, d in enumerate(all_dates) if d in target_set]
        filtered = {
            "inputs": unit_data.get("inputs"),
            "outputs": unit_data.get("outputs"),
            "summary": {},
        }
        for key in ("consumed", "produced", "imbalance", "imbalance_rel"):
            filtered["summary"][key] = {}
            for stream in ("measured", "reconciled"):
                arr = unit_data["summary"][key][stream]
                filtered["summary"][key][stream] = [arr[i] for i in indices if i < len(arr)]
        return filtered

    def get_available_months(self) -> List[int]:
        """Return sorted list of month numbers (1-12) that have data."""
        return sorted(set(d.month for d in self.dates))

    def filter_dates(self, date_from: Optional[str] = None, date_to: Optional[str] = None,
                     month: Optional[int] = None) -> List[date]:
        """Filter dates by range or month. Returns filtered date list."""
        from datetime import datetime
        filtered = list(self.dates)
        if month is not None and 1 <= month <= 12:
            filtered = [d for d in filtered if d.month == month]
        if date_from:
            try:
                df = datetime.strptime(date_from, "%Y-%m-%d").date()
                filtered = [d for d in filtered if d >= df]
            except ValueError:
                pass
        if date_to:
            try:
                dt = datetime.strptime(date_to, "%Y-%m-%d").date()
                filtered = [d for d in filtered if d <= dt]
            except ValueError:
                pass
        return filtered

    def get_unit_series(self, code: str) -> Optional[Dict]:
        """Return full time-series for a unit (all days)."""
        unit = self.units.get(code)
        if not unit:
            return None
        dates = unit["dates"]
        result = {
            "code": code,
            "name": unit["name"],
            "dates": [d.isoformat() for d in dates],
            "consumed": unit["data"]["summary"]["consumed"],
            "produced": unit["data"]["summary"]["produced"],
            "imbalance": unit["data"]["summary"]["imbalance"],
            "imbalance_rel": unit["data"]["summary"]["imbalance_rel"],
        }
        return result


store = DataStore()
