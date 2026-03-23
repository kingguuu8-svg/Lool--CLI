@echo off
setlocal
cd /d "%~dp0"
set "RUNTIME_DIR=%CD%\.runtime"
set "ACCESS_INFO_FILE=%RUNTIME_DIR%\vps-access.txt"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-access-token.ps1" -ProjectRoot "%CD%"`) do set "ACCESS_TOKEN=%%I"
if not defined ACCESS_TOKEN exit /b 1

if not exist "%CD%\config\vps.json" (
  echo Missing config\vps.json
  echo Copy config\vps.example.json to config\vps.json and fill in your VPS values first.
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-vps-key.ps1" -ProjectRoot "%CD%"`) do set "VPS_KEY_PATH=%%I"
if not defined VPS_KEY_PATH exit /b 1

set "ACCESS_TOKEN_FILE=%CD%\.secrets\access-token.txt"
set "NO_OPEN_BROWSER=1"
call "%~dp0start-server.bat" local
if errorlevel 1 exit /b 1

echo Configuring VPS reverse proxy...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-vps-proxy.ps1" -ProjectRoot "%CD%"
if errorlevel 1 exit /b 1

echo Starting VPS reverse SSH tunnel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-vps-tunnel.ps1" -ProjectRoot "%CD%"
if errorlevel 1 exit /b 1

set /p PUBLIC_URL=<"%CD%\.runtime\public-url.txt"
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
(
  echo URL=%PUBLIC_URL%
  echo ACCESS_TOKEN=%ACCESS_TOKEN%
) > "%ACCESS_INFO_FILE%"

echo.
echo VPS URL:
echo   %PUBLIC_URL%
echo Access token:
echo   %ACCESS_TOKEN%
echo Saved to:
echo   %ACCESS_INFO_FILE%
echo.
echo First open the URL, then enter the access token on the login page.
