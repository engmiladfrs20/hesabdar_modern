@echo off
title Construction Accounting App - Offline Launcher
color 0B
echo ====================================================================
echo        CONSTRUCTION ACCOUNTING APP - OFFLINE DESKTOP LAUNCHER
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

echo [1/3] Verifying and installing base dependencies...
if not exist node_modules (
    call npm install
) else (
    echo Base dependencies are already installed.
)
echo.

echo [2/3] Building the full-stack application...
call npm run build
echo.

echo [3/3] Starting the offline local server on port 3000...
echo Opening your default web browser to the application...
start http://localhost:3000
call npm start
pause
