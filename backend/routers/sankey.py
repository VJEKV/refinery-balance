"""GET /api/sankey"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime

from services.store import store
from services.sankey_builder import build_sankey, build_sankey_multi

router = APIRouter(prefix="/api/sankey", tags=["sankey"])


@router.get("")
def get_sankey(
    date: str = Query(..., description="Дата YYYY-MM-DD"),
    type: str = Query("reconciled"),
    units: Optional[str] = None,
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Неверный формат даты")
    if type not in ("measured", "reconciled"):
        raise HTTPException(400, "type: measured или reconciled")
    unit_filter = set(units.split(",")) if units else None
    return build_sankey_multi(store, [target_date], type, unit_filter)


@router.get("/monthly")
def get_sankey_monthly(
    year: int = Query(...),
    month: int = Query(...),
    type: str = Query("reconciled"),
    units: Optional[str] = None,
):
    """Sankey за месяц — суммирует все дни месяца."""
    target_month = f"{year:04d}-{month:02d}"
    available = sorted([d for d in store.dates if d.strftime("%Y-%m") == target_month])
    if not available:
        raise HTTPException(404, f"Нет данных за {target_month}")
    unit_filter = set(units.split(",")) if units else None
    return build_sankey_multi(store, available, type, unit_filter)


@router.get("/range")
def get_sankey_range(
    date_from: str = Query(...),
    date_to: str = Query(...),
    type: str = Query("reconciled"),
    units: Optional[str] = None,
):
    """Sankey за диапазон дат."""
    try:
        df = datetime.strptime(date_from, "%Y-%m-%d").date()
        dt = datetime.strptime(date_to, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Формат: YYYY-MM-DD")
    if type not in ("measured", "reconciled"):
        raise HTTPException(400, "type: measured или reconciled")
    available = sorted([d for d in store.dates if df <= d <= dt])
    if not available:
        raise HTTPException(404, "Нет данных за указанный диапазон")
    unit_filter = set(units.split(",")) if units else None
    return build_sankey_multi(store, available, type, unit_filter)
