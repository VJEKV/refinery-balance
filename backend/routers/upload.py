"""POST /api/upload, GET /api/files — только локальный режим."""
import os
import sys
from fastapi import APIRouter, UploadFile, File, HTTPException

from config import DATA_DIR
from services.store import store

router = APIRouter(prefix="/api", tags=["files"])


def _is_local():
    """Загрузка разрешена только при локальном запуске (.exe или ALLOW_UPLOAD=1)."""
    if getattr(sys, 'frozen', False):
        return True
    return os.environ.get("ALLOW_UPLOAD", "0") == "1"


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not _is_local():
        raise HTTPException(403, "Загрузка файлов отключена на сервере")
    if not file.filename.endswith((".xlsm", ".xlsx")):
        raise HTTPException(400, "Только .xlsm/.xlsx файлы")
    dest = os.path.join(DATA_DIR, file.filename)
    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)
    # Парсим только новый файл, не перечитываем все
    store.add_file(dest)
    return {"filename": file.filename, "status": "ok"}


@router.get("/files")
def list_files():
    return store.get_file_list()


@router.delete("/files/{filename}")
def delete_file(filename: str):
    if not _is_local():
        raise HTTPException(403, "Удаление файлов отключено на сервере")
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Файл не найден")
    os.remove(path)
    store.load_all()
    return {"status": "deleted", "filename": filename}
