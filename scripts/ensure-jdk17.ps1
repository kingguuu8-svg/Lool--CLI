param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$toolsDir = Join-Path $ProjectRoot ".tools"
$jdkRoot = Join-Path $toolsDir "jdk17"
$zipPath = Join-Path $toolsDir "OpenJDK17.zip"
$apiUrl = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"

New-Item -ItemType Directory -Force $toolsDir | Out-Null

$existingHome = Get-ChildItem $jdkRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "bin\javac.exe") } |
    Select-Object -First 1 -ExpandProperty FullName

if ($existingHome) {
    Write-Output $existingHome
    exit 0
}

Invoke-WebRequest -Uri $apiUrl -OutFile $zipPath

if (Test-Path $jdkRoot) {
    Remove-Item $jdkRoot -Recurse -Force
}
New-Item -ItemType Directory -Force $jdkRoot | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $jdkRoot -Force

$jdkHome = Get-ChildItem $jdkRoot -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "bin\javac.exe") } |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $jdkHome) {
    throw "Failed to prepare local JDK 17."
}

Write-Output $jdkHome
