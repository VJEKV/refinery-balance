@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   НПЗ МБ — Сборка v1.4.0
echo ================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Python не найден. Установите Python 3.11+
    pause
    exit /b
)

echo [1/3] Установка Python-зависимостей...
pip install -r requirements.txt pyinstaller -q

if exist frontend\dist\index.html (
    echo [2/3] Фронтенд уже собран, пропускаю...
) else (
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ОШИБКА: frontend\dist не найден и Node.js не установлен.
        pause
        exit /b
    )
    echo [2/3] Сборка фронтенда...
    cd frontend
    call npm ci
    call npm run build
    cd ..
)

echo [3/3] Сборка server.exe...
pyinstaller server.spec --distpath release --workpath build_tmp -y

if exist release\NPZ_MB rd /s /q release\NPZ_MB
mkdir release\NPZ_MB
mkdir release\NPZ_MB\data
mkdir release\NPZ_MB\frontend

xcopy /s /e /y /q release\server release\NPZ_MB\server\
xcopy /s /e /y /q frontend\dist release\NPZ_MB\frontend\dist\
copy /y START.bat release\NPZ_MB\
copy /y STOP.bat release\NPZ_MB\

rd /s /q build_tmp

echo.
echo ================================================
echo   Готово! Папка: release\NPZ_MB\
echo   Положите .xlsm в data\, запуск: START.bat
echo ================================================
pause
exit
