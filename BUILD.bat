@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   НПЗ МБ — Полная сборка v1.2.2
echo ================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Python не найден. Установите Python 3.11+
    pause
    exit /b
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Node.js не найден. Установите Node.js 20+
    pause
    exit /b
)

echo [1/4] Установка Python-зависимостей...
pip install -r requirements.txt pyinstaller -q

echo [2/4] Сборка фронтенда...
cd frontend
call npm ci
call npm run build
cd ..

echo [3/4] Сборка server.exe...
pyinstaller server.spec --distpath release --workpath build_tmp -y

echo [4/4] Сборка папки НПЗ_МБ...
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
echo   Скопируйте на флешку, положите .xlsm в data\
echo   Запуск: START.bat
echo ================================================
pause
exit
