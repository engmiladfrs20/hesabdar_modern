@echo off
title Construction Accounting App - Deploy Online (Cloudflare Workers + D1)
color 0B
echo ====================================================================
echo      CONSTRUCTION ACCOUNTING APP - ONLINE CLOUDFLARE DEPLOYER
echo              Designed for Eng. Milad Farrokhi and Saze Team
echo ====================================================================
echo.
echo This tool will build your frontend assets, remove local server bundles
echo from the static dist folder, apply D1 database schema updates, and
echo deploy the full online version to Cloudflare Workers.
echo.
pause

echo [1/4] Building web frontend with Vite...
call npx vite build
echo.

echo [2/4] Cleaning any backend server bundle from static assets folder...
if exist "dist\server.cjs" del /f /q "dist\server.cjs" >nul 2>&1
if exist "dist\server.cjs.map" del /f /q "dist\server.cjs.map" >nul 2>&1
echo.

echo [3/4] Updating Cloudflare D1 remote database schema (schema.sql)...
call npx wrangler d1 execute hesabdar_peymankar --remote --file=schema.sql
echo.

echo [4/4] Deploying Worker and static assets to Cloudflare...
call npx wrangler deploy
echo.

echo ====================================================================
echo Online Deployment Completed!
echo Your online version is now live on your Cloudflare Workers domain.
echo ====================================================================
pause
