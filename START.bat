@echo off
chcp 65001 >nul
cd /d "%~dp0"

taskkill /f /im python.exe >nul 2>&1

netstat -ano | findstr ":8001 " >nul 2>&1
if %errorlevel%==0 (
    echo Port 8001 busy, waiting...
    ping -n 3 127.0.0.1 >nul
)

echo Installing dependencies...
pip install -r requirements.txt -q 2>nul

echo Starting NPZ Material Balance...
cd backend
start /min "" python -m uvicorn main:app --host 127.0.0.1 --port 8001
cd ..

ping -n 4 127.0.0.1 >nul

start http://127.0.0.1:8001
exit
