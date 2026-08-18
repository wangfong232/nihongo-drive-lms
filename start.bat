@echo off
echo ===================================================
echo [DriveLearn] Starting Nihongo LMS Services...
echo ===================================================

echo [1/3] Starting PostgreSQL Container...
docker start nihongo-postgres

echo [2/3] Starting .NET 10 Backend API (Port 5222)...
start "Nihongo LMS Backend (.NET 10)" cmd /k "cd /d E:\Projects\DriveLearn_v1.0 && dotnet run --project src/NihongoLms.Api/NihongoLms.Api.csproj"

echo Waiting for backend API to initialize...
timeout /t 4 /nobreak > nul

echo [3/3] Starting Next.js Frontend (Port 3000)...
start "Nihongo LMS Frontend (Next.js 16)" cmd /k "cd /d E:\Projects\DriveLearn_v1.0\frontend && npm run dev"

echo ===================================================
echo All services launched! 
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:5222/swagger
echo ===================================================