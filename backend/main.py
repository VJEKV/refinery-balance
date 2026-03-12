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
    title="НПЗ Материальный Баланс",
    description="Аналитика аномалий нефтеперерабатывающего завода",
    version="1.2.2",
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
    return {"status": "ok", "app": "НПЗ Материальный Баланс", "version": "1.2.2"}


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
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
