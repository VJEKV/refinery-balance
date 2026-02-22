"""GET /api/sankey"""
from fastapi import APIRouter, Query, HTTPException
from datetime import date, datetime

from services.store import store
from services.sankey_builder import build_sankey

router = APIRouter(prefix="/api/sankey", tags=["sankey"])


@router.get("")
def get_sankey(
    date: str = Query(..., description="Дата в формате YYYY-MM-DD"),
    type: str = Query("reconciled", description="measured или reconciled"),
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Неверный формат даты. Используйте YYYY-MM-DD")
    if type not in ("measured", "reconciled"):
        raise HTTPException(400, "type должен быть 'measured' или 'reconciled'")
    return build_sankey(store, target_date, type)


@router.get("/monthly")
def get_sankey_monthly(
    year: int = Query(...),
    month: int = Query(...),
    type: str = Query("reconciled"),
):
    """Sankey за месяц — используем первую доступную дату в этом месяце."""
    target_month = f"{year:04d}-{month:02d}"
    available = [d for d in store.dates if d.strftime("%Y-%m") == target_month]
    if not available:
        raise HTTPException(404, f"Нет данных за {target_month}")
    return build_sankey(store, available[0], type)
