"""FastAPI app + CORS + lifespan + роутеры."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.store import store
from routers import upload, units, analytics, anomalies, sankey, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.load_all()
    print(f"Загружено файлов: {len(store.files)}, установок: {len(store.units)}, дат: {len(store.dates)}")
    yield


app = FastAPI(
    title="ТИТАН МБ",
    description="Аналитика материального баланса нефтеперерабатывающего завода",
    version="1.9.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(units.router)
app.include_router(analytics.router)
app.include_router(anomalies.router)
app.include_router(sankey.router)
app.include_router(settings.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "ТИТАН МБ", "version": "1.8.2"}


# Production: раздача собранного React из frontend/dist
import os
import sys
from fastapi.responses import FileResponse, HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware


class NoCacheHTMLMiddleware(BaseHTTPMiddleware):
    """Запрещает кэширование index.html — браузер всегда получает свежую версию."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        ct = response.headers.get("content-type", "")
        if "text/html" in ct:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


app.add_middleware(NoCacheHTMLMiddleware)


def _get_dist_dir():
    if getattr(sys, 'frozen', False):
        # .exe в server/ → frontend/dist рядом
        return os.path.join(os.path.dirname(os.path.dirname(sys.executable)), "frontend", "dist")
    return os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

DIST_DIR = _get_dist_dir()
if os.path.isdir(DIST_DIR):
    from fastapi.staticfiles import StaticFiles
    from starlette.exceptions import HTTPException as StarletteHTTPException

    # Статика (JS, CSS, изображения)
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """SPA fallback — отдаёт index.html для всех не-API маршрутов."""
        file_path = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
