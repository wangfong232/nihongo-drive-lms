@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo [DriveLearn] Starting Nihongo LMS Services...
echo ===================================================

echo [1/3] Starting PostgreSQL Container...
docker start nihongo-postgres 2>nul || (
    echo Container nihongo-postgres not found. Creating a new one...
    docker run --name nihongo-postgres -e POSTGRES_DB=nihongo_lms -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16-alpine
)

echo [2/3] Starting .NET Backend API (Port 5222)...
start "DriveLearn Backend (.NET)" cmd /k "cd /d ""%~dp0"" && dotnet run --project src/NihongoLms.Api/NihongoLms.Api.csproj"

echo Waiting for backend API to initialize...
timeout /t 4 /nobreak > nul

echo [3/3] Starting Next.js Frontend (Port 3000)...
start "DriveLearn Frontend (Next.js 16)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo ===================================================
echo All services launched! 
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:5222/swagger
echo ===================================================
pause