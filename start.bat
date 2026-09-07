@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo [DriveLearn] Starting Nihongo LMS Services...
echo ===================================================

echo [1/3] Checking PostgreSQL Container...
docker start nihongo-postgres 2>nul || (
    echo Container nihongo-postgres not found. Creating a new one with persistent volume...
    docker run --name nihongo-postgres -v nihongo_pgdata:/var/lib/postgresql/data -e POSTGRES_DB=nihongo_lms -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16-alpine
)

echo [2/3] Starting .NET Backend API (Port 5222)...
echo (Database migrations will be automatically applied on startup)
start "DriveLearn Backend (.NET)" cmd /k "cd /d ""%~dp0"" && dotnet run --project src/NihongoLms.Api/NihongoLms.Api.csproj"

echo Waiting for backend API and database to initialize...
timeout /t 5 /nobreak > nul

echo [3/3] Checking Frontend Dependencies...
if not exist "%~dp0frontend\node_modules" (
    echo node_modules not found in frontend. Installing dependencies for first-time setup...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
)

echo Starting Next.js Frontend (Port 3000)...
start "DriveLearn Frontend (Next.js 16)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo ===================================================
echo [SUCCESS] All services launched! 
echo 🌐 Frontend LMS: http://localhost:3000
echo ⚙️ Admin CMS: http://localhost:3000/admin
echo 📡 Backend Swagger: http://localhost:5222/swagger
echo ===================================================
pause