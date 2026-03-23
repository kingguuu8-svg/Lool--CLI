@echo off
setlocal
for %%I in ("%~dp0.") do set "ROOT_DIR=%%~fI"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\ensure-electron.ps1" -ProjectRoot "%ROOT_DIR%"`) do set "ELECTRON_EXE=%%I"
if not defined ELECTRON_EXE exit /b 1

cd /d "%ROOT_DIR%"
start "" "%ELECTRON_EXE%" .
