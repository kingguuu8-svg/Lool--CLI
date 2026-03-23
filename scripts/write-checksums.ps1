param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$distDir = Join-Path $ProjectRoot "dist"
$outputPath = Join-Path $distDir "checksums.txt"

if (-not (Test-Path $distDir)) {
    throw "dist directory not found. Build the release artifacts first."
}

$files = Get-ChildItem -Path $distDir -Recurse -File | Where-Object { $_.Name -match '\.(apk|zip|exe)$' }
if (-not $files) {
    throw "No APK, ZIP, or EXE files found under dist."
}

$lines = foreach ($file in $files) {
    $hash = Get-FileHash -Path $file.FullName -Algorithm SHA256
    "{0}  {1}" -f $hash.Hash.ToLowerInvariant(), (Resolve-Path -Relative $file.FullName)
}

Set-Content -Path $outputPath -Value $lines -Encoding UTF8
Write-Output $outputPath
