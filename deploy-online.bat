@echo off
title Construction Accounting App - Deploy Online (Cloudflare Workers + D1)
color 0B
echo ====================================================================
echo      CONSTRUCTION ACCOUNTING APP - ONLINE CLOUDFLARE DEPLOYER
echo              Designed for Eng. Milad Farrokhi and Saze Team
echo ====================================================================
echo.
echo This tool will build your frontend assets, auto-discover your
echo Cloudflare D1 database ID, apply D1 schema updates, and deploy
echo the full online version to Cloudflare Workers.
echo.
pause

echo [1/2] Building web frontend with Vite...
call npx vite build
if exist "dist\server.cjs" del /f /q "dist\server.cjs" >nul 2>&1
if exist "dist\server.cjs.map" del /f /q "dist\server.cjs.map" >nul 2>&1
echo.

echo [2/2] Auto-discovering D1 Database and deploying to Cloudflare...
call node scripts/cloudflare-deploy.mjs
echo.

echo ====================================================================
echo Online Deployment Completed!
echo Your online version is now live on your Cloudflare Workers domain.
echo ====================================================================
pause
