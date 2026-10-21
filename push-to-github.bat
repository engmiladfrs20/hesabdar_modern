@echo off
chcp 65001 >nul
title Push Changes to GitHub & Auto-Deploy to Cloudflare
color 0A
echo ====================================================================
echo      GIT PUSH ^& AUTOMATIC CLOUDFLARE CI/CD DEPLOYMENT
echo ====================================================================
echo.

git status >nul 2>&1
if %errorlevel% neq 0 (
    echo Initializing Git repository...
    git init
    git branch -M main
)

echo [1/3] Staging all updated files...
git add .

set /p COMMIT_MSG="Enter commit description (Press Enter for default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update Construction Accounting Suite and sync Cloudflare Worker

echo [2/3] Creating commit...
git commit -m "%COMMIT_MSG%"

echo [3/3] Pushing to GitHub (triggers automatic Cloudflare deployment via GitHub Actions)...
git push -u origin main

echo.
echo ====================================================================
echo Done! GitHub Actions (.github/workflows/deploy.yml) will now build
echo and publish your changes to Cloudflare Workers + D1 automatically.
echo ====================================================================
pause
