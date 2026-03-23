param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$androidDir = Join-Path $ProjectRoot "android"
$localPropertiesPath = Join-Path $androidDir "local.properties"

$candidates = @(
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    "C:\gps_android_sdk",
    (Join-Path $env:LOCALAPPDATA "Android\Sdk")
) | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique

$sdkDir = $candidates |
    Where-Object { Test-Path (Join-Path $_ "platforms") } |
    Select-Object -First 1

if (-not $sdkDir) {
    throw "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install the SDK in a standard location."
}

$escapedSdkDir = $sdkDir.Replace("\", "\\")
$content = "sdk.dir=$escapedSdkDir"

if ((-not (Test-Path $localPropertiesPath)) -or ((Get-Content -Raw $localPropertiesPath) -ne $content)) {
    Set-Content -Path $localPropertiesPath -Value $content -Encoding ASCII
}

Write-Output $sdkDir
