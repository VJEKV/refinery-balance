# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec для НПЗ Материальный Баланс."""

import os

backend_dir = os.path.join(os.getcwd(), 'backend')

a = Analysis(
    [os.path.join(backend_dir, 'run_server.py')],
    pathex=[backend_dir],
    binaries=[],
    datas=[],
    hiddenimports=[
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'fastapi',
        'fastapi.staticfiles',
        'starlette',
        'starlette.staticfiles',
        'starlette.responses',
        'multipart',
        'multipart.multipart',
        'pandas',
        'numpy',
        'openpyxl',
        'aiofiles',
        'config',
        'main',
        'services',
        'services.store',
        'services.parser',
        'services.anomaly',
        'services.aggregator',
        'services.sankey_builder',
        'services.product_recon',
        'routers',
        'routers.upload',
        'routers.units',
        'routers.analytics',
        'routers.anomalies',
        'routers.sankey',
        'routers.settings',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'PIL', 'scipy', 'IPython', 'notebook'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='server',
)
