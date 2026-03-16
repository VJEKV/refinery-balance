"""Точка входа для PyInstaller .exe — запускает uvicorn с FastAPI."""
import sys
import os
import multiprocessing

if __name__ == "__main__":
    multiprocessing.freeze_support()

    # Рабочая директория = папка рядом с .exe
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))

    import uvicorn
    from main import app  # noqa: F401

    print("=" * 50)
    print("  ТИТАН МБ — Аналитика")
    print("  http://127.0.0.1:8001")
    print("=" * 50)

    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
