@echo off
rem Double-click to run SnapShare on Windows.
rem Installs what is missing, starts the site and opens the browser.
cd /d "%~dp0"
title SnapShare

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Download the LTS version from https://nodejs.org, install it,
  echo then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing required libraries. This only happens the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting SnapShare at http://localhost:3000
echo Close this window to stop the site.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npm start
pause
