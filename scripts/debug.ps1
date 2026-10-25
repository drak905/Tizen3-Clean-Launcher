# Restart the launcher on the TV with the web inspector enabled and forward its port to this PC.
# Then: $env:CDP_PORT = <port>; node scripts\cdp.js "document.title" "JSON.parse(localStorage.diag).slice(-20)"
# Usage: .\scripts\debug.ps1 [-TvIp <TV_IP>]   (or set $env:TV_IP)      Stop: .\tools\sdb.exe forward --remove-all
param([string]$TvIp = $env:TV_IP)
$ErrorActionPreference = 'Stop'
if (-not $TvIp) { throw 'Pass -TvIp <TV address> or set $env:TV_IP' }
$root = Split-Path -Parent $PSScriptRoot
$sdb = Join-Path $root 'tools\sdb.exe'
if (-not (Test-Path $sdb)) { $sdb = Join-Path $env:USERPROFILE 'tizen-studio\tools\sdb.exe' }
$dev = "${TvIp}:26101"
& $sdb connect $dev | Out-Null
& $sdb forward --remove-all 2>&1 | Out-Null
& $sdb -s $dev shell 0 kill AppleTVDoc 2>&1 | Out-Null
Start-Sleep 3
# The trailing "300" is ignored by the TV's app_launcher but makes the debug launch succeed reliably;
# without an extra argument it often answers "closed".
$o = & $sdb -s $dev shell 0 debug AppleTVDoc.AppleTVDock 300 2>&1 | Out-String
$port = [regex]::Match($o, 'port:\s*(\d+)').Groups[1].Value
if (-not $port) { $o | Out-Host; throw 'debug launch failed (try again)' }
& $sdb -s $dev forward "tcp:$port" "tcp:$port" | Out-Null
$env:CDP_PORT = $port
Write-Host "Inspector forwarded: http://127.0.0.1:$port/json   (CDP_PORT=$port set for this shell)"

