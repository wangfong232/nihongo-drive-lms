@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo [DriveLearn] Updating Nihongo LMS to Latest Version
echo ===================================================

echo [1/3] Pulling latest changes from Git...
git pull origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git pull failed! Please check your network or local changes.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Applying Database Migrations (EF Core)...
dotnet ef database update --project src/NihongoLms.Infrastructure --startup-project src/NihongoLms.Api
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Database migration command returned an error.
    echo If dotnet-ef is not installed, run: dotnet tool install --global dotnet-ef
)

echo.
echo [3/3] Updating Frontend Dependencies (npm install)...
cd /d "%~dp0frontend"
call npm install
cd /d "%~dp0"

echo.
echo ===================================================
echo [SUCCESS] Update completed successfully!
echo You can now launch the LMS by running start.bat
echo ===================================================
pause
