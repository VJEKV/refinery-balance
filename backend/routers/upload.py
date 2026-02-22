"""POST /api/upload, GET /api/files"""
import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException

from config import DATA_DIR
from services.store import store

router = APIRouter(prefix="/api", tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsm", ".xlsx")):
        raise HTTPException(400, "Только .xlsm/.xlsx файлы")
    dest = os.path.join(DATA_DIR, file.filename)
    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)
    store.load_all()
    return {"filename": file.filename, "status": "ok"}


@router.get("/files")
def list_files():
    return store.get_file_list()


@router.delete("/files/{filename}")
def delete_file(filename: str):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Файл не найден")
    os.remove(path)
    store.load_all()
    return {"status": "deleted", "filename": filename}
