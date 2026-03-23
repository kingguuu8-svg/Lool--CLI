param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$toolsDir = Join-Path $ProjectRoot ".tools"
$electronRoot = Join-Path $toolsDir "electron"
$electronExe = Join-Path $electronRoot "electron.exe"
$zipPath = Join-Path $toolsDir "electron-v36.1.0-win32-x64.zip"
$downloadUrl = "https://github.com/electron/electron/releases/download/v36.1.0/electron-v36.1.0-win32-x64.zip"

New-Item -ItemType Directory -Force $toolsDir | Out-Null

if (Test-Path $electronExe) {
    Write-Output $electronExe
    exit 0
}

Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

if (Test-Path $electronRoot) {
    Remove-Item $electronRoot -Recurse -Force
}
New-Item -ItemType Directory -Force $electronRoot | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $electronRoot -Force

if (-not (Test-Path $electronExe)) {
    throw "Failed to prepare Electron runtime."
}

Write-Output $electronExe
