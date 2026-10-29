@echo off
rem Start the integrated app; model/runtime installation is an explicit separate action.
cd /d "%~dp0"
title Open Ad Studio Release Candidate
where node >nul 2>nul || (echo Install Node.js 22.18+ from https://nodejs.org then run this again. & pause & exit /b 1)
if not exist "node_modules\@comfyorg\sdk" (call npm ci || (pause & exit /b 1))
echo Open Ad Studio: http://127.0.0.1:8340/adstudio/journey.html
echo Close this window to stop this app server.
call npm start
pause
