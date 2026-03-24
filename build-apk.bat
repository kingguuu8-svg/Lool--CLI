@echo off
setlocal
for %%I in ("%~dp0.") do set "ROOT_DIR=%%~fI"
set "ANDROID_DIR=%ROOT_DIR%\android"
set "DIST_DIR=%ROOT_DIR%\dist\android"
set "LOCAL_JDK_HOME="
set "LOCAL_ANDROID_SDK="

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\ensure-jdk17.ps1" -ProjectRoot "%ROOT_DIR%"`) do set "LOCAL_JDK_HOME=%%I"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\ensure-android-sdk.ps1" -ProjectRoot "%ROOT_DIR%"`) do set "LOCAL_ANDROID_SDK=%%I"

if defined LOCAL_JDK_HOME (
  set "JAVA_HOME=%LOCAL_JDK_HOME%"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\javac.exe" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)

if defined LOCAL_ANDROID_SDK (
  set "ANDROID_HOME=%LOCAL_ANDROID_SDK%"
  set "ANDROID_SDK_ROOT=%LOCAL_ANDROID_SDK%"
  set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
)

cd /d "%ANDROID_DIR%"

if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

if exist "gradle-8.2\bin\gradle.bat" (
  set "GRADLE_CMD=gradle-8.2\bin\gradle.bat"
) else (
  set "GRADLE_CMD=gradlew.bat"
)

call "%GRADLE_CMD%" assembleDebug
if errorlevel 1 exit /b 1

if exist "%ANDROID_DIR%\keystore.properties" (
  call "%GRADLE_CMD%" assembleRelease
  if errorlevel 1 exit /b 1
)

if exist "%ANDROID_DIR%\app\build\outputs\apk\debug\app-debug.apk" (
  copy /y "%ANDROID_DIR%\app\build\outputs\apk\debug\app-debug.apk" "%DIST_DIR%\app-debug.apk" >nul
)

del /q "%DIST_DIR%\PocketCLI-Mobile-v*-debug.apk" 2>nul
for %%F in ("%ANDROID_DIR%\app\build\outputs\apk\debug\PocketCLI-Mobile-v*-debug.apk") do (
  if exist "%%~fF" copy /y "%%~fF" "%DIST_DIR%\%%~nxF" >nul
)

if exist "%ANDROID_DIR%\app\build\outputs\apk\release\app-release.apk" (
  copy /y "%ANDROID_DIR%\app\build\outputs\apk\release\app-release.apk" "%DIST_DIR%\app-release.apk" >nul
)

del /q "%DIST_DIR%\PocketCLI-Mobile-v*-release.apk" 2>nul
for %%F in ("%ANDROID_DIR%\app\build\outputs\apk\release\PocketCLI-Mobile-v*-release.apk") do (
  if exist "%%~fF" copy /y "%%~fF" "%DIST_DIR%\%%~nxF" >nul
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\write-checksums.ps1" -ProjectRoot "%ROOT_DIR%" >nul

echo.
echo APK outputs:
if exist "%DIST_DIR%\app-debug.apk" echo   %DIST_DIR%\app-debug.apk
for %%F in ("%DIST_DIR%\PocketCLI-Mobile-v*-debug.apk") do if exist "%%~fF" echo   %%~fF
if exist "%DIST_DIR%\app-release.apk" (
  echo   %DIST_DIR%\app-release.apk
) else (
  echo   Release APK skipped. Add android\keystore.properties to enable signed release builds.
)
for %%F in ("%DIST_DIR%\PocketCLI-Mobile-v*-release.apk") do if exist "%%~fF" echo   %%~fF
if exist "%ROOT_DIR%\dist\checksums.txt" echo   %ROOT_DIR%\dist\checksums.txt
