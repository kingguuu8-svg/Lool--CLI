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
$runtimeDir = Join-Path $ProjectRoot ".runtime"
$publicUrlFile = Join-Path $runtimeDir "public-url.txt"
$providerFile = Join-Path $runtimeDir "tunnel.provider"
$pidFile = Join-Path $runtimeDir "tunnel.pid"
$outLog = Join-Path $runtimeDir "tunnel.out.log"
$errLog = Join-Path $runtimeDir "tunnel.err.log"
$sshExe = (Get-Command ssh -ErrorAction Stop).Source
$keyPath = Join-Path $ProjectRoot ".runtime\vps-key.pem"
$remotePort = [int]$config.remotePort

if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile | Select-Object -First 1
    if ($oldPid) {
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Remove-Item $outLog -Force -ErrorAction SilentlyContinue
Remove-Item $errLog -Force -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $sshExe `
    -ArgumentList @(
        "-N",
        "-T",
        "-i", $keyPath,
        "-o", "UserKnownHostsFile=NUL",
        "-o", "GlobalKnownHostsFile=NUL",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
        "-o", "ExitOnForwardFailure=yes",
        "-R", "127.0.0.1:$remotePort`:127.0.0.1:3000",
        "$($config.user)@$($config.host)"
    ) `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

Set-Content -Path $pidFile -Value $process.Id
Set-Content -Path $providerFile -Value "vps-reverse-ssh"
Set-Content -Path $publicUrlFile -Value $config.publicUrl

$healthUrl = $config.publicUrl.TrimEnd("/") + "/api/health"
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
        if ($response.ok) {
            $ok = $true
            break
        }
    } catch {
    }

    Start-Sleep -Milliseconds 750
}

if (-not $ok) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "VPS public URL did not become reachable."
}

Write-Output "provider=vps-reverse-ssh"
Write-Output ("url=" + $config.publicUrl)
