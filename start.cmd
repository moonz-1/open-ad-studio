@echo off
setlocal
cd /d "%~dp0"
title Open Ad Studio
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.18 or newer from https://nodejs.org, then reopen this file.
  echo Choose the Node.js LTS installer with npm included.
  pause
  exit /b 1
)
node adstudio/scripts/launch.mjs
if errorlevel 1 pause
