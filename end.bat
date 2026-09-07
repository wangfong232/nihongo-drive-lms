@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo [DriveLearn] Stopping Nihongo LMS Services...
echo ===================================================

echo [1/3] Stopping .NET Backend API (Port 5222)...
taskkill /f /im NihongoLms.Api.exe 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5222" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a 2>nul
)

echo [2/3] Stopping Next.js Frontend (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a 2>nul
)

echo [3/3] Stopping PostgreSQL Container (nihongo-postgres)...
docker stop nihongo-postgres 2>nul

echo ===================================================
echo [SUCCESS] All DriveLearn services have been safely stopped!
echo ===================================================
pause
