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

echo [1/3] Installing dependencies...
pip install fastapi uvicorn[standard] openpyxl python-calamine pandas numpy python-multipart aiofiles pyinstaller -q

echo [2/3] Building server.exe...
pyinstaller server.spec --distpath release --workpath build_tmp -y

echo [3/3] Creating release folder...
if exist release\NPZ_MB rd /s /q release\NPZ_MB
mkdir release\NPZ_MB
mkdir release\NPZ_MB\data

xcopy /s /e /y /q release\server release\NPZ_MB\server\
xcopy /s /e /y /q frontend\dist release\NPZ_MB\frontend\dist\

copy /y START.bat release\NPZ_MB\
copy /y STOP.bat release\NPZ_MB\

rd /s /q build_tmp

echo.
echo ================================================
echo   Done! Folder: release\NPZ_MB\
echo ================================================
echo.
echo   NPZ_MB\
echo     START.bat         - start
echo     STOP.bat          - stop
echo     server\server.exe - server
echo     frontend\dist\    - UI
echo     data\             - put .xlsm files here
echo.
pause
exit
