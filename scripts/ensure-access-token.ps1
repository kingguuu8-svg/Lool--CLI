param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$secretsDir = Join-Path $ProjectRoot ".secrets"
$tokenPath = Join-Path $secretsDir "access-token.txt"

New-Item -ItemType Directory -Force $secretsDir | Out-Null

if (-not (Test-Path $tokenPath)) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
    Set-Content -Path $tokenPath -Value $token
}

Get-Content $tokenPath | Select-Object -First 1
