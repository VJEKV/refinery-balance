@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   Сборка server.exe для НПЗ Материальный Баланс
echo ================================================
echo.

:: Проверяем Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Python не найден. Установите Python 3.11+
    echo https://www.python.org/downloads/
    pause
    exit /b
)

:: Устанавливаем зависимости
echo [1/3] Установка зависимостей...
pip install fastapi uvicorn[standard] openpyxl pandas numpy python-multipart aiofiles pyinstaller -q

:: Собираем .exe
echo [2/3] Сборка server.exe (2-5 минут)...
pyinstaller server.spec --distpath release --workpath build_tmp -y

:: Формируем готовую папку для флешки
echo [3/3] Формирование релиза...
if exist release\НПЗ_МБ rd /s /q release\НПЗ_МБ
mkdir release\НПЗ_МБ
mkdir release\НПЗ_МБ\data

:: Копируем server + зависимости
xcopy /s /e /y /q release\server release\НПЗ_МБ\server\

:: Копируем frontend
xcopy /s /e /y /q frontend\dist release\НПЗ_МБ\frontend\dist\

:: Копируем bat-файлы
copy /y START.bat release\НПЗ_МБ\
copy /y STOP.bat release\НПЗ_МБ\

:: Очистка
rd /s /q build_tmp

echo.
echo ================================================
echo   Готово! Папка release\НПЗ_МБ\ готова
echo   для копирования на флешку
echo ================================================
echo.
echo Структура:
echo   НПЗ_МБ\
echo     START.bat        — запуск
echo     STOP.bat         — остановка
echo     server\server.exe — сервер
echo     frontend\dist\   — интерфейс
echo     data\            — сюда класть .xlsm файлы
echo.
pause
exit
