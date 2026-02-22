"""DataStore — загрузка всех .xlsm в RAM через parser.py."""
import os
import glob
import re
from datetime import date
from typing import Dict, List, Optional

from config import DATA_DIR
from services.parser import parse_report


class DataStore:
    def __init__(self):
        self.files: List[Dict] = []
        self.units: Dict = {}
        self.dates: List[date] = []
        self._file_meta: List[Dict] = []

    def load_all(self):
        """Загрузить все .xlsm из DATA_DIR."""
        self.files = []
        self.units = {}
        self.dates = []
        self._file_meta = []

        pattern = os.path.join(DATA_DIR, "*.xlsm")
        for path in sorted(glob.glob(pattern)):
            try:
                report = parse_report(path)
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
                for unit_name, unit_data in report["units"].items():
                    code = self._make_code(unit_name)
                    if code not in self.units:
                        self.units[code] = {
                            "code": code,
                            "name": unit_name,
                            "data": unit_data,
                            "dates": list(report["dates"]),
                        }
                    else:
                        existing = self.units[code]
                        for d in report["dates"]:
                            if d not in existing["dates"]:
                                existing["dates"].append(d)
                        self._merge_unit(existing["data"], unit_data, report["dates"])
            except Exception as e:
                print(f"Ошибка загрузки {path}: {e}")

        self.dates.sort()

    def _make_code(self, name: str) -> str:
        cleaned = re.sub(r'[^\w\s]', '', name)
        parts = cleaned.split()
        code = "_".join(parts[:3]).lower()
        return code or name[:20].lower().replace(" ", "_")

    def _merge_unit(self, existing, new_data, new_dates):
        import pandas as pd
        for key in ("inputs", "outputs"):
            if new_data[key] is not None:
                if existing[key] is None:
                    existing[key] = new_data[key]
                else:
                    existing[key] = pd.concat([existing[key], new_data[key]], ignore_index=True)
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
                    prods.append({
                        "product": row["product"],
                        "measured": row.get(f"{ds}_meas", 0.0),
                        "reconciled": row.get(f"{ds}_recon", 0.0),
                    })
                result[direction] = prods
            else:
                result[direction] = []
        return result

    def get_all_dates(self) -> List[str]:
        return [d.isoformat() for d in self.dates]

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
