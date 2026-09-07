@echo off
echo TripShare - http://localhost:3000 で開いてください
echo Ctrl+C で停止
cd /d "%~dp0"
python -m http.server 3000
