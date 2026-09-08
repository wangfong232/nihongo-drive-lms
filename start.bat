@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===================================================
echo   [DriveLearn] Khởi động hệ thống Nihongo LMS
echo ===================================================
echo.

:: ── BƯỚC 1: KIỂM TRA VÀ KHỞI ĐỘNG POSTGRESQL DOCKER ──
echo [1/3] Kiểm tra dịch vụ Cơ sở dữ liệu PostgreSQL (Port 5433)...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [CẢNH BÁO] Docker Desktop chưa bật hoặc chưa sẵn sàng!
    echo Đang thử khởi động container nếu Docker đã chạy ngầm...
)

docker start nihongo-postgres >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Container nihongo-postgres chưa tồn tại. Đang tạo mới container với persistent volume...
    docker run --name nihongo-postgres -v nihongo_pgdata:/var/lib/postgresql/data -e POSTGRES_DB=nihongo_lms -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16-alpine >nul 2>&1
)

echo Đang chờ PostgreSQL sẵn sàng kết nối...
set /a PG_RETRIES=0
:WAIT_PG
docker exec nihongo-postgres pg_isready -U postgres >nul 2>&1
if %ERRORLEVEL% EQU 0 goto PG_READY
set /a PG_RETRIES+=1
if %PG_RETRIES% GEQ 15 (
    echo [CẢNH BÁO] PostgreSQL phản hồi chậm, tiếp tục khởi động Backend...
    goto PG_READY
)
timeout /t 1 /nobreak > nul
goto WAIT_PG

:PG_READY
echo [OK] PostgreSQL đã sẵn sàng!
echo.

:: ── BƯỚC 2: KHỞI ĐỘNG .NET BACKEND API (PORT 5222) ──
echo [2/3] Khởi động .NET Backend API (Port 5222)...
echo (Hệ thống sẽ tự động kiểm tra và áp dụng EF Core Migrations)
start "DriveLearn Backend (.NET 10)" cmd /k "cd /d ""%~dp0"" && dotnet run --project src/NihongoLms.Api/NihongoLms.Api.csproj"

echo Đang chờ Backend API khởi động và đồng bộ Database...
set /a API_RETRIES=0
:WAIT_API
powershell -NoProfile -Command "(Invoke-WebRequest -Uri 'http://localhost:5222/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode" 2>nul | findstr "200" >nul
if %ERRORLEVEL% EQU 0 goto API_READY
set /a API_RETRIES+=1
if %API_RETRIES% GEQ 30 (
    echo [CẢNH BÁO] Backend API đang mất nhiều thời gian để build/khởi động. Tiếp tục mở Frontend...
    goto API_READY
)
timeout /t 1 /nobreak > nul
goto WAIT_API

:API_READY
echo [OK] Backend API đã sẵn sàng và Database đã được đồng bộ!
echo.

:: ── BƯỚC 3: KHỞI ĐỘNG NEXT.JS FRONTEND (PORT 3000) ──
echo [3/3] Chuẩn bị Frontend (Next.js 16)...
if not exist "%~dp0frontend\node_modules" (
    echo Phát hiện lần đầu chạy: Đang cài đặt thư viện node_modules...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
)

echo Khởi động máy chủ giao diện (Port 3000)...
start "DriveLearn Frontend (Next.js 16)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo Đang chờ Frontend sẵn sàng...
set /a FE_RETRIES=0
:WAIT_FE
powershell -NoProfile -Command "(Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode" 2>nul | findstr "200" >nul
if %ERRORLEVEL% EQU 0 goto ALL_READY
set /a FE_RETRIES+=1
if %FE_RETRIES% GEQ 20 (
    goto ALL_READY
)
timeout /t 1 /nobreak > nul
goto WAIT_FE

:ALL_READY
echo.
echo ===================================================
echo [THÀNH CÔNG] Toàn bộ hệ thống DriveLearn đã sẵn sàng!
echo.
echo 🌐 Giao diện Học viên: http://localhost:3000
echo ⚙️ Quản trị CMS:      http://localhost:3000/admin
echo 📡 Backend Swagger:    http://localhost:5222/swagger
echo ===================================================
echo.

:: Tự động mở trình duyệt
start http://localhost:3000

pause