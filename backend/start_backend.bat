@echo off
title Deluzex Backend API Server
echo ===================================================
echo   Starting Deluzex Backend API (Port 8000)
echo ===================================================
cd /d "%~dp0"
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
