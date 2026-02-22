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
    version="1.0.0",
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


@app.get("/")
def root():
    return {"status": "ok", "app": "НПЗ Материальный Баланс"}
