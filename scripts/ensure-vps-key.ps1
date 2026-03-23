param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$configPath = Join-Path $ProjectRoot "config\vps.json"
if (-not (Test-Path $configPath)) {
    throw "Missing config\vps.json. Copy config\vps.example.json and fill it in first."
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$sourceKeyPath = [string]$config.keyPath

if ([string]::IsNullOrWhiteSpace($sourceKeyPath)) {
    throw "config\vps.json is missing keyPath."
}

if (-not (Test-Path $sourceKeyPath)) {
    throw "VPS private key not found: $sourceKeyPath"
}

$runtimeDir = Join-Path $ProjectRoot ".runtime"
$targetKeyPath = Join-Path $runtimeDir "vps-key.pem"

New-Item -ItemType Directory -Force $runtimeDir | Out-Null

if (-not (Test-Path $targetKeyPath)) {
    Copy-Item -Force $sourceKeyPath $targetKeyPath
}

$sid = ((whoami /user) | Select-String "S-1-5-21").ToString().Split()[-1]
& cmd.exe /c "icacls `"$targetKeyPath`" /inheritance:r /grant:r `"*$sid:R`"" | Out-Null

Write-Output $targetKeyPath
