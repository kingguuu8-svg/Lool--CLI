@echo off
setlocal
cd /d "%~dp0"

set "PROJECT_ROOT=%CD%"
set "OUTPUT_DIR=%PROJECT_ROOT%\dist\launcher"
set "PUBLISH_DIR=%OUTPUT_DIR%\publish"
set "EXE_NAME=LoolCLI-Launcher.exe"
set "FINAL_EXE=%OUTPUT_DIR%\LoolCLI-Launcher-win-x64.exe"
set "NUGET_PACKAGES=%PROJECT_ROOT%\.nuget\packages"
set "DOTNET_CLI_HOME=%PROJECT_ROOT%\.dotnet"
set "DOTNET_NOLOGO=1"
set "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1"

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
if not exist "%NUGET_PACKAGES%" mkdir "%NUGET_PACKAGES%"
if not exist "%DOTNET_CLI_HOME%" mkdir "%DOTNET_CLI_HOME%"

dotnet publish "%PROJECT_ROOT%\launcher\LoolCLI.Launcher.csproj" ^
  -c Release ^
  -r win-x64 ^
  --self-contained true ^
  /p:RestorePackagesPath="%NUGET_PACKAGES%" ^
  /p:PublishSingleFile=true ^
  /p:IncludeNativeLibrariesForSelfExtract=true ^
  /p:PublishTrimmed=false ^
  /p:DebugType=None ^
  /p:DebugSymbols=false ^
  -o "%PUBLISH_DIR%"
if errorlevel 1 exit /b 1

if not exist "%PUBLISH_DIR%\%EXE_NAME%" (
  echo Missing launcher executable after publish.
  exit /b 1
)

copy /Y "%PUBLISH_DIR%\%EXE_NAME%" "%FINAL_EXE%" >nul
if errorlevel 1 exit /b 1

rmdir /S /Q "%PUBLISH_DIR%" 2>nul

echo Built:
echo   %FINAL_EXE%
