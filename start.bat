@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: Set console colors
color 0B

:: Simple color codes
set "BLUE=\033[94m"
set "GREEN=\033[92m"
set "RED=\033[91m"
set "YELLOW=\033[93m"
set "PURPLE=\033[95m"
set "CYAN=\033[96m"
set "WHITE=\033[97m"
set "RESET=\033[0m"
set "BOLD=\033[1m"

:: Window title
title bearChat Setup and Launcher

:: Clear screen with a fancy animation
cls
echo.
timeout /t 1 > nul

:: ASCII Art
echo   _                     ____ _           _   
echo  ^| ^|__   ___  __ _ _ __/ ___^| ^|__   __ _^| ^|_ 
echo  ^| '_ \ / _ \/ _` ^| '__^| ^|   ^| '_ \ / _` ^| __^|
echo  ^| ^|_) ^|  __/ (_^| ^| ^|  ^| ^|___^| ^| ^| ^| (_^| ^| ^|_ 
echo  ^|_.__/ \___^|\__,_^|_^|   \____^|_^| ^|_^|\__,_^|\__^|
echo.
echo ════════════════════════════════════════════
echo            Welcome to bearChat Setup          
echo ════════════════════════════════════════════
echo.

:: Add delay for better readability
timeout /t 1 > nul

:: Check if Python is installed
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

:: Check if pip is available
echo [SYSTEM] Checking pip installation...
python -m pip --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pip is not installed properly.
    pause
    exit /b 1
)
echo [SUCCESS] pip is installed!
timeout /t 1 > nul

:: Check if requirements.txt exists
if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found in the current directory.
    pause
    exit /b 1
)

:: Check if virtual environment exists
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

:: Activate virtual environment
echo [SYSTEM] Activating virtual environment...
call venv\Scripts\activate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)
echo [SUCCESS] Virtual environment activated!
timeout /t 1 > nul

:: Install/Update pip
echo [SYSTEM] Updating pip...
python -m pip install --upgrade pip > nul
echo [SUCCESS] pip updated!
timeout /t 1 > nul

:: Install requirements
echo [SYSTEM] Installing required packages...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install requirements
    pause
    exit /b 1
)

:: Clear screen
cls
echo.

:: Success message with ASCII art
echo   _                     ____ _           _   
echo  ^| ^|__   ___  __ _ _ __/ ___^| ^|__   __ _^| ^|_ 
echo  ^| '_ \ / _ \/ _` ^| '__^| ^|   ^| '_ \ / _` ^| __^|
echo  ^| ^|_) ^|  __/ (_^| ^| ^|  ^| ^|___^| ^| ^| ^| (_^| ^| ^|_ 
echo  ^|_.__/ \___^|\__,_^|_^|   \____^|_^| ^|_^|\__,_^|\__^|
echo.
echo ════════════════════════════════════════════
echo      All dependencies installed successfully!   
echo ════════════════════════════════════════════
echo.
echo [INFO] Starting bearChat...
echo.

:: Check if app.py exists
if not exist "app.py" (
    echo [ERROR] app.py not found in the current directory.
    pause
    exit /b 1
)

:: Start the application
python app.py

:: If application crashes, don't close window immediately
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application crashed. Check the error message above.
    pause > nul
)

:: Deactivate virtual environment
deactivate

pause > nul 