@echo off
setlocal
cd /d "%~dp0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=local"

set "HOST_VALUE=127.0.0.1"
if /I "%MODE%"=="lan" set "HOST_VALUE=0.0.0.0"

set "OPEN_URL=http://127.0.0.1:3000"
set "RUNTIME_DIR=%CD%\.runtime"
set "PID_FILE=%RUNTIME_DIR%\server.pid"
set "OUT_LOG=%RUNTIME_DIR%\server.out.log"
set "ERR_LOG=%RUNTIME_DIR%\server.err.log"
set "ACCESS_TOKEN_VALUE="

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"

if not exist node_modules (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if defined ACCESS_TOKEN_FILE (
  if exist "%ACCESS_TOKEN_FILE%" (
    set /p ACCESS_TOKEN_VALUE=<"%ACCESS_TOKEN_FILE%"
  )
)

echo Stopping old server on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pidFile = '%PID_FILE%';" ^
  "if (Test-Path $pidFile) {" ^
  "  $oldPid = Get-Content $pidFile | Select-Object -First 1;" ^
  "  if ($oldPid) { Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue }" ^
  "  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue" ^
  "}" ^
  "$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique;" ^
  "foreach ($listenerPid in $listeners) { Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue }"

echo Starting server in %MODE% mode...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$env:HOST = '%HOST_VALUE%';" ^
  "if ('%ACCESS_TOKEN_VALUE%' -ne '') { $env:ACCESS_TOKEN = '%ACCESS_TOKEN_VALUE%' }" ^
  "$p = Start-Process -FilePath 'node' -ArgumentList 'server/server.js' -WorkingDirectory '%CD%' -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%' -PassThru;" ^
  "Set-Content -Path '%PID_FILE%' -Value $p.Id;" ^
  "Write-Output ('PID=' + $p.Id)"
if errorlevel 1 exit /b 1

echo Waiting for http://127.0.0.1:3000/api/health ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok = $false;" ^
  "for ($i = 0; $i -lt 40; $i++) {" ^
  "  try {" ^
  "    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2;" ^
  "    if ($res.ok) { $ok = $true; break }" ^
  "  } catch {}" ^
  "  Start-Sleep -Milliseconds 500" ^
  "}" ^
  "if (-not $ok) { Write-Error 'Server did not become healthy in time.'; exit 1 }"
if errorlevel 1 (
  echo Server failed to start. Check:
  echo   %OUT_LOG%
  echo   %ERR_LOG%
  exit /b 1
)

if /I not "%NO_OPEN_BROWSER%"=="1" (
  start "" "%OPEN_URL%"
)

if /I "%MODE%"=="lan" (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address -ne $null } ^| Select-Object -First 1 -ExpandProperty IPv4Address ^| Select-Object -ExpandProperty IPAddress)"`) do set "LAN_IP=%%I"
  if defined LAN_IP (
    echo.
    echo Local browser URL:
    echo   http://127.0.0.1:3000
    echo Phone APK URL:
    echo   http://%LAN_IP%:3000
  ) else (
    echo.
    echo Local browser URL:
    echo   http://127.0.0.1:3000
    echo Could not detect LAN IP automatically. Run ipconfig if needed.
  )
) else (
  echo.
  echo Local browser URL:
  echo   http://127.0.0.1:3000
)

echo.
echo Logs:
echo   %OUT_LOG%
echo   %ERR_LOG%
