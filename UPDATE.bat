@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   НПЗ МБ — Обновление с GitHub
echo ========================================
echo.

:: Сохранить данные и настройки перед обновлением
if exist refinery-balance\data\thresholds.json copy /y refinery-balance\data\thresholds.json _thresholds_backup >nul

echo Скачивание обновления...
curl -L -o update.zip "https://github.com/VJEKV/refinery-balance/archive/refs/heads/main.zip"
if not exist update.zip (
    echo ОШИБКА: не удалось скачать обновление
    pause
    exit /b
)

echo Распаковка...
if exist _temp rd /s /q _temp
tar -xf update.zip -C . 2>nul
if not exist refinery-balance-main (
    mkdir _temp
    powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath '_temp' -Force"
    set "SRC=_temp\refinery-balance-main"
) else (
    set "SRC=refinery-balance-main"
)

echo Обновление файлов...
:: Удаляем старые backend и frontend (data не трогаем!)
if exist refinery-balance\backend rd /s /q refinery-balance\backend
if exist refinery-balance\frontend rd /s /q refinery-balance\frontend
if exist refinery-balance\deploy rd /s /q refinery-balance\deploy

:: Копируем новые
xcopy /s /e /y /q %SRC%\backend refinery-balance\backend\
xcopy /s /e /y /q %SRC%\frontend refinery-balance\frontend\
xcopy /s /e /y /q %SRC%\deploy refinery-balance\deploy\

:: Обновить .bat на корневом уровне (те, что запускает пользователь)
if exist %SRC%\START.bat copy /y %SRC%\START.bat START.bat >nul
if exist %SRC%\STOP.bat copy /y %SRC%\STOP.bat STOP.bat >nul
if exist %SRC%\UPDATE.bat copy /y %SRC%\UPDATE.bat UPDATE.bat >nul

:: Обновить .md файлы
if exist %SRC%\CLAUDE.md copy /y %SRC%\CLAUDE.md refinery-balance\CLAUDE.md >nul
if exist %SRC%\ARCHITECTURE.md copy /y %SRC%\ARCHITECTURE.md refinery-balance\ARCHITECTURE.md >nul
if exist %SRC%\requirements.txt copy /y %SRC%\requirements.txt refinery-balance\requirements.txt >nul

:: Восстановить настройки пользователя
if exist _thresholds_backup (
    copy /y _thresholds_backup refinery-balance\data\thresholds.json >nul
    del _thresholds_backup
)

:: Очистка
if exist _temp rd /s /q _temp
if exist refinery-balance-main rd /s /q refinery-balance-main
del update.zip

echo.
echo ========================================
echo   Готово! Запустите START.bat
echo ========================================
pause
exit
