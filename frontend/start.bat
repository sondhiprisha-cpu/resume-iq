@echo off
echo ========================================
echo     ResumeIQ Frontend Startup
echo ========================================
echo.
echo [1/2] Installing dependencies...
call npm install
echo.
echo [2/2] Starting React app...
echo.
echo ========================================
echo  Frontend running at http://localhost:3000
echo  Make sure backend is running too!
echo  Press Ctrl+C to stop
echo ========================================
echo.
npm start
pause
