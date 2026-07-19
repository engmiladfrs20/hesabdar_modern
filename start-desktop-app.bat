@echo off
title Construction Accounting App - Electron Launcher
color 0E
echo ====================================================================
echo        CONSTRUCTION ACCOUNTING APP - ELECTRON DESKTOP LAUNCHER
echo              Designed for Eng. Milad Farrokhi and Saze Team
echo ====================================================================
echo.

rem Check Node.js installation
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed on this system!
    echo Please download and install Node.js from: https://nodejs.org/
    echo After installation, please run this file again.
    echo.
    pause
    exit /b
)

echo [1/4] Verifying and installing web dependencies...
if not exist node_modules (
    call npm install
) else (
    echo Web dependencies are already installed.
)
echo.

echo [2/4] Building the application assets...
call npm run build
echo.

echo [3/4] Checking and installing Electron environment...
if not exist node_modules\electron (
    echo Installing electron and electron-builder for offline packaging...
    call npm install electron electron-builder --save-dev
) else (
    echo Electron packages are already installed.
)
echo.

echo [4/4] Launching the Electron native desktop container...
npx electron electron-main.cjs
pause
