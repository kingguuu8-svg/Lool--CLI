@echo off
setlocal
cd /d "%~dp0"

set "RUNTIME_DIR=%CD%\.runtime"
set "PID_FILE=%RUNTIME_DIR%\server.pid"
set "TUNNEL_PID_FILE=%RUNTIME_DIR%\tunnel.pid"

echo Stopping server...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pidFile = '%PID_FILE%';" ^
  "$tunnelPidFile = '%TUNNEL_PID_FILE%';" ^
  "if (Test-Path $pidFile) {" ^
  "  $oldPid = Get-Content $pidFile | Select-Object -First 1;" ^
  "  if ($oldPid) { Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue }" ^
  "  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue" ^
  "}" ^
  "if (Test-Path $tunnelPidFile) {" ^
  "  $tunnelPid = Get-Content $tunnelPidFile | Select-Object -First 1;" ^
  "  if ($tunnelPid) { Stop-Process -Id $tunnelPid -Force -ErrorAction SilentlyContinue }" ^
  "  Remove-Item $tunnelPidFile -Force -ErrorAction SilentlyContinue" ^
  "}" ^
  "Remove-Item '%RUNTIME_DIR%\public-url.txt' -Force -ErrorAction SilentlyContinue;" ^
  "Remove-Item '%RUNTIME_DIR%\tunnel.provider' -Force -ErrorAction SilentlyContinue;" ^
  "Remove-Item '%RUNTIME_DIR%\vps-key.pem' -Force -ErrorAction SilentlyContinue;" ^
  "$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique;" ^
  "foreach ($listenerPid in $listeners) { Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue }"

echo Done.
