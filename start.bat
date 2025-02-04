@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

color 0B

set "BLUE=\033[94m"
set "GREEN=\033[92m"
set "RED=\033[91m"
set "YELLOW=\033[93m"
set "PURPLE=\033[95m"
set "CYAN=\033[96m"
set "WHITE=\033[97m"
set "RESET=\033[0m"
set "BOLD=\033[1m"

title bearCode Setup and Launcher

cls
echo.
timeout /t 1 > nul

echo   _                     ____          _      
echo  ^| ^|__   ___  __ _ _ __/ ___|___   __^| ^| ___ 
echo  ^| '_ \ / _ \/ _` ^| '__^| ^|   / _ \ / _` ^|/ _ \
echo  ^| ^|_) ^|  __/ (_^| ^| ^|  ^| ^|__^| (_) ^| (_^| ^|  __/
echo  ^|_.__/ \___^|\__,_^|_^|   \____\___/ \__,_^|\___^|
echo.
echo ════════════════════════════════════════════
echo            Welcome to bearCode Setup          
echo ════════════════════════════════════════════
echo.

timeout /t 1 > nul

echo [SYSTEM] Checking Python installation...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed on this system.
    echo [INFO] Please install Python 3.8 or higher from python.org
    pause
    exit /b 1
)
echo [SUCCESS] Python is installed!
timeout /t 1 > nul

echo [SYSTEM] Checking pip installation...
python -m pip --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pip is not installed properly.
    pause
    exit /b 1
)
echo [SUCCESS] pip is installed!
timeout /t 1 > nul

if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found in the current directory.
    pause
    exit /b 1
)

if not exist "venv" (
    echo [SYSTEM] Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [SUCCESS] Virtual environment created!
    timeout /t 1 > nul
)

echo [SYSTEM] Activating virtual environment...
call venv\Scripts\activate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)
echo [SUCCESS] Virtual environment activated!
timeout /t 1 > nul

echo [SYSTEM] Updating pip...
python -m pip install --upgrade pip > nul
echo [SUCCESS] pip updated!
timeout /t 1 > nul

echo [SYSTEM] Installing required packages...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install requirements
    pause
    exit /b 1
)

cls
echo.

echo   _                     ____          _      
echo  ^| ^|__   ___  __ _ _ __/ ___|___   __^| ^| ___ 
echo  ^| '_ \ / _ \/ _` ^| '__^| ^|   / _ \ / _` ^|/ _ \
echo  ^| ^|_) ^|  __/ (_^| ^| ^|  ^| ^|__^| (_) ^| (_^| ^|  __/
echo  ^|_.__/ \___^|\__,_^|_^|   \____\___/ \__,_^|\___^|
echo.
echo ════════════════════════════════════════════
echo      All dependencies installed successfully!   
echo ════════════════════════════════════════════
echo.
echo [INFO] Starting bearCode...
echo.

if not exist "app.py" (
    echo [ERROR] app.py not found in the current directory.
    pause
    exit /b 1
)

python app.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application crashed. Check the error message above.
    pause > nul
)

deactivate

pause > nul 
