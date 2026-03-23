@echo off
setlocal
cd /d "%~dp0"

call "%~dp0start-server.bat" local
if errorlevel 1 exit /b 1

echo Starting public tunnel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-public-tunnel.ps1" -ProjectRoot "%CD%"
if errorlevel 1 exit /b 1

if exist "%CD%\.runtime\public-url.txt" (
  set /p PUBLIC_URL=<"%CD%\.runtime\public-url.txt"
)

if exist "%CD%\.runtime\tunnel.provider" (
  set /p PUBLIC_PROVIDER=<"%CD%\.runtime\tunnel.provider"
)

if not defined PUBLIC_URL (
  echo Failed to obtain a public URL.
  echo Check:
  echo   %CD%\.runtime\tunnel.out.log
  echo   %CD%\.runtime\tunnel.err.log
  exit /b 1
)

echo.
echo Public tunnel provider:
echo   %PUBLIC_PROVIDER%
echo Public URL:
echo   %PUBLIC_URL%
echo Copied to clipboard when possible.
