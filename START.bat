@echo off
chcp 65001 >nul
cd /d "%~dp0"

taskkill /f /im server.exe >nul 2>&1

netstat -ano | findstr ":8001 " >nul 2>&1
if %errorlevel%==0 (
    echo Port 8001 busy, waiting...
    ping -n 3 127.0.0.1 >nul
)

echo Starting NPZ Material Balance...
start /min "" "%~dp0server\server.exe"

ping -n 5 127.0.0.1 >nul

start http://127.0.0.1:8001
exit
