"""GET/PUT /api/settings/thresholds"""
import json
import os
from fastapi import APIRouter
from pydantic import BaseModel

from config import DEFAULT_THRESHOLDS, THRESHOLDS_FILE

router = APIRouter(prefix="/api/settings", tags=["settings"])


class Thresholds(BaseModel):
    balance_closure: float = 3.0
    recon_gap: float = 5.0
    spc_sigma: float = 3.0
    cusum_drift: float = 5.0
    downtime_pct: float = 10.0
    cross_unit: float = 5.0


@router.get("/thresholds")
def get_thresholds():
    if os.path.exists(THRESHOLDS_FILE):
        with open(THRESHOLDS_FILE) as f:
            return json.load(f)
    return DEFAULT_THRESHOLDS.copy()


@router.put("/thresholds")
def update_thresholds(thresholds: Thresholds):
    data = thresholds.model_dump()
    with open(THRESHOLDS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    return data


@router.post("/thresholds/reset")
def reset_thresholds():
    if os.path.exists(THRESHOLDS_FILE):
        os.remove(THRESHOLDS_FILE)
    return DEFAULT_THRESHOLDS.copy()
