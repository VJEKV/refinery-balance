@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   Building server.exe
echo ================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python 3.11+
    pause
    exit /b
)

echo [1/2] Installing dependencies...
pip install -r requirements.txt pyinstaller -q

echo [2/2] Building server.exe...
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
echo   Done! Copy release\NPZ_MB\ to flash drive
echo ================================================
pause
exit
