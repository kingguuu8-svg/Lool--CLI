param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$runtimeDir = Join-Path $ProjectRoot ".runtime"
$toolsDir = Join-Path $ProjectRoot ".tools\cloudflared"
$publicUrlFile = Join-Path $runtimeDir "public-url.txt"
$providerFile = Join-Path $runtimeDir "tunnel.provider"
$pidFile = Join-Path $runtimeDir "tunnel.pid"
$outLog = Join-Path $runtimeDir "tunnel.out.log"
$errLog = Join-Path $runtimeDir "tunnel.err.log"

function Remove-RuntimeFile {
    param([string]$Path)
    if (Test-Path $Path) {
        Remove-Item $Path -Force -ErrorAction SilentlyContinue
    }
}

function Stop-ExistingTunnel {
    if (Test-Path $pidFile) {
        $existingPid = Get-Content $pidFile | Select-Object -First 1
        if ($existingPid) {
            Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
        }
    }

    Remove-RuntimeFile $pidFile
    Remove-RuntimeFile $providerFile
    Remove-RuntimeFile $publicUrlFile
}

function Get-CommandPath {
    param([string]$CommandName)
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    return $null
}

function Ensure-Cloudflared {
    $localExe = Join-Path $toolsDir "cloudflared.exe"
    if (Test-Path $localExe) {
        return $localExe
    }

    $pathExe = Get-CommandPath "cloudflared"
    if ($pathExe) {
        return $pathExe
    }

    New-Item -ItemType Directory -Force $toolsDir | Out-Null
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $localExe -UseBasicParsing
    return $localExe
}

function Read-CombinedLogs {
    $parts = @()
    if (Test-Path $outLog) {
        $parts += Get-Content -Raw $outLog
    }
    if (Test-Path $errLog) {
        $parts += Get-Content -Raw $errLog
    }
    return ($parts -join "`n")
}

function Wait-ForUrl {
    param(
        [string]$RegexPattern,
        [int]$TimeoutSeconds = 25
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $text = Read-CombinedLogs
        $match = [regex]::Match($text, $RegexPattern)
        if ($match.Success) {
            return $match.Value
        }
        Start-Sleep -Milliseconds 500
    }

    return $null
}

function Wait-ForPublicHealth {
    param(
        [string]$BaseUrl,
        [int]$TimeoutSeconds = 45
    )

    $healthUrl = $BaseUrl.TrimEnd("/") + "/api/health"
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
            if ($response.ok) {
                return $true
            }
        } catch {
        }

        Start-Sleep -Milliseconds 750
    }

    return $false
}

function Start-CloudflaredTunnel {
    $cloudflaredExe = Ensure-Cloudflared

    Remove-RuntimeFile $outLog
    Remove-RuntimeFile $errLog

    $process = Start-Process -FilePath $cloudflaredExe `
        -ArgumentList @("tunnel", "--url", "http://127.0.0.1:3000", "--no-autoupdate") `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -PassThru

    Set-Content -Path $pidFile -Value $process.Id
    Set-Content -Path $providerFile -Value "cloudflared"

    $url = Wait-ForUrl -RegexPattern "https://[-a-z0-9]+\.trycloudflare\.com"
    if (-not $url) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "cloudflared started but did not produce a public URL."
    }

    if (-not (Wait-ForPublicHealth -BaseUrl $url)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "cloudflared produced a public URL but it never became reachable."
    }

    Set-Content -Path $publicUrlFile -Value $url
    return $url
}

function Start-LocalhostRunTunnel {
    Remove-RuntimeFile $outLog
    Remove-RuntimeFile $errLog

    $sshExe = Get-CommandPath "ssh"
    if (-not $sshExe) {
        throw "ssh.exe is not available on this machine."
    }

    $process = Start-Process -FilePath $sshExe `
        -ArgumentList @(
            "-tt",
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            "-o", "ServerAliveInterval=30",
            "-o", "ExitOnForwardFailure=yes",
            "-R", "80:127.0.0.1:3000",
            "nokey@localhost.run"
        ) `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -PassThru

    Set-Content -Path $pidFile -Value $process.Id
    Set-Content -Path $providerFile -Value "localhost.run"

    $url = Wait-ForUrl -RegexPattern "(?<=tls termination,\s)https://[^\s]+"
    if (-not $url) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "localhost.run tunnel started but did not produce a public URL."
    }

    if (-not (Wait-ForPublicHealth -BaseUrl $url)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "localhost.run produced a public URL but it never became reachable."
    }

    Set-Content -Path $publicUrlFile -Value $url
    return $url
}

New-Item -ItemType Directory -Force $runtimeDir | Out-Null
Stop-ExistingTunnel

$publicUrl = $null
$provider = $null
$errors = New-Object System.Collections.Generic.List[string]

try {
    $publicUrl = Start-LocalhostRunTunnel
    $provider = "localhost.run"
} catch {
    $errors.Add($_.Exception.Message)
}

if (-not $publicUrl) {
    try {
        $publicUrl = Start-CloudflaredTunnel
        $provider = "cloudflared"
    } catch {
        $errors.Add($_.Exception.Message)
    }
}

if (-not $publicUrl) {
    Stop-ExistingTunnel
    throw ("Failed to start public tunnel. " + ($errors -join " | "))
}

try {
    Set-Clipboard -Value $publicUrl
} catch {
}

Write-Output ("provider=" + $provider)
Write-Output ("url=" + $publicUrl)
