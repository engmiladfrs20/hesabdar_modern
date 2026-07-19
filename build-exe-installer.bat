@echo off
title Construction Accounting App - Packaging EXE Installer
color 0A
echo ====================================================================
echo        CONSTRUCTION ACCOUNTING APP - WINDOWS EXE INSTALLER BUILDER
echo              Designed for Eng. Milad Farrokhi and Saze Team
echo ====================================================================
echo.
echo This tool will bundle your app assets and compile a standalone 
echo Windows Desktop Installer (.exe) inside the 'release' directory.
echo.
pause

echo [1/5] Terminating any running Electron apps to unlock files...
taskkill /f /im electron.exe >nul 2>&1
echo.

echo [2/5] Cleaning up temporary build folders to avoid permission errors...
if exist "dist\win-unpacked" (
    echo Attempting to remove legacy unpacked folder inside dist...
    rmdir /s /q "dist\win-unpacked" >nul 2>&1
    if exist "dist\win-unpacked" (
        echo Note: Some legacy unpacked files inside 'dist\win-unpacked' are locked by Windows.
        echo This is normal and we will bypass them to build.
    )
)
if exist "release\win-unpacked" (
    echo Attempting to remove old release folder...
    rmdir /s /q "release\win-unpacked" >nul 2>&1
)
echo.

echo [3/5] Compiling and building web assets and server backend...
call npm run build
echo.

echo [4/5] Checking and verifying package builders...
if not exist node_modules\electron-builder (
    echo Installing electron-builder packaging environment...
    call npm install electron electron-builder --save-dev
)
echo.

echo [5/5] Packaging Windows desktop installer with NSIS...
:: Back up the main web package.json
copy /y package.json package-web-temp.json >nul
:: Activate desktop package config
copy /y package-desktop.json package.json >nul
echo Config temporarily swapped to desktop package definitions.

call npx electron-builder --win nsis
echo.

:: Restore web package.json
copy /y package-web-temp.json package.json >nul
del package-web-temp.json >nul
echo Config restored to web development mode.
echo.

echo ====================================================================
echo Packaging completed successfully!
echo.
echo Your Windows EXE installer has been created inside the 'release/' folder:
echo.
echo - Setup File: release\ConstructionAccountingOffline Setup 1.0.0.exe
echo - Portable Unpacked Folder: release\win-unpacked\
echo ====================================================================
pause
