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
$keyPath = Join-Path $ProjectRoot ".runtime\vps-key.pem"
$runtimeDir = Join-Path $ProjectRoot ".runtime"
$localConfPath = Join-Path $runtimeDir "pocketcli.nginx.conf"
$remoteTempConf = "/tmp/pocketcli.conf"
$sshExe = (Get-Command ssh -ErrorAction Stop).Source
$scpExe = (Get-Command scp -ErrorAction Stop).Source
$remotePort = [int]$config.remotePort
$sshTarget = "$($config.user)@$($config.host)"
$serverName = $config.host

if ($config.publicUrl) {
    try {
        $serverName = ([Uri]$config.publicUrl).Host
    } catch {
        $serverName = $config.host
    }
}

New-Item -ItemType Directory -Force $runtimeDir | Out-Null

$nginxConf = @'
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;
    server_name __SERVER_NAME__;

    location / {
        proxy_pass http://127.0.0.1:__REMOTE_PORT__;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
'@.Replace("__REMOTE_PORT__", [string]$remotePort).Replace("__SERVER_NAME__", $serverName)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($localConfPath, $nginxConf, $utf8NoBom)

& $scpExe `
    -i $keyPath `
    -o UserKnownHostsFile=NUL `
    -o GlobalKnownHostsFile=NUL `
    -o StrictHostKeyChecking=no `
    $localConfPath `
    "${sshTarget}:$remoteTempConf" | Out-Null

$remoteScript = @"
set -e
if command -v dnf >/dev/null 2>&1; then
  dnf install -y nginx policycoreutils-python-utils >/dev/null 2>&1 || dnf install -y nginx >/dev/null 2>&1
elif command -v yum >/dev/null 2>&1; then
  yum install -y nginx >/dev/null 2>&1
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update >/dev/null 2>&1
  apt-get install -y nginx >/dev/null 2>&1
fi

mv $remoteTempConf /etc/nginx/conf.d/pocketcli.conf
sed -i '1s/^\xEF\xBB\xBF//' /etc/nginx/conf.d/pocketcli.conf
nginx -t

if command -v setsebool >/dev/null 2>&1; then
  setsebool -P httpd_can_network_connect 1 >/dev/null 2>&1 || true
fi

systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx
"@

& $sshExe `
    -i $keyPath `
    -o UserKnownHostsFile=NUL `
    -o GlobalKnownHostsFile=NUL `
    -o StrictHostKeyChecking=no `
    -o ConnectTimeout=10 `
    $sshTarget `
    $remoteScript | Out-Null

Write-Output "ok"
