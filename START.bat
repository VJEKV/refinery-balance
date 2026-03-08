@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: Убить старый процесс если висит
taskkill /f /im server.exe >nul 2>&1

:: Проверить порт 8001 — если занят, подождать
netstat -ano | findstr ":8001 " >nul 2>&1
if %errorlevel%==0 (
    echo Порт 8001 занят, ожидание освобождения...
    ping -n 3 127.0.0.1 >nul
)

echo Запуск НПЗ Материальный Баланс...
start /min "" "%~dp0server\server.exe"

:: Ожидание запуска сервера
ping -n 5 127.0.0.1 >nul

:: Открыть браузер
start http://127.0.0.1:8001
exit
