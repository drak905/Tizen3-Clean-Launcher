# Baseline snapshot of the TV BEFORE changing anything (read-only on the TV).
# Usage: $env:TV_IP = '<TV address>'; .\scripts\backup_tv.ps1
# Writes backups\tv_api_v2_baseline.json, sdb_capability_baseline.txt, applist_baseline.txt and a SHA-256
# manifest. The REST API output identifies your TV and Wi-Fi (MAC, router BSSID, UUIDs): the backups/
# folder is git-ignored in the public repository - keep it that way.
param([string]$TvIp = $env:TV_IP)
$ErrorActionPreference = 'Stop'
if (-not $TvIp) { throw 'Pass -TvIp <TV address> or set $env:TV_IP' }
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$sdb = Join-Path $root 'tools\sdb.exe'
if (-not (Test-Path $sdb)) { $sdb = Join-Path $env:USERPROFILE 'tizen-studio\tools\sdb.exe' }
$dev = "${TvIp}:26101"
New-Item -ItemType Directory -Force backups\screenshots | Out-Null
if (Test-Path backups\manifest.sha256) { throw 'backups\manifest.sha256 already exists: a baseline must only be taken once. Move it away first.' }

& $sdb connect $dev | Out-Host
curl.exe -s -m 10 "http://${TvIp}:8001/api/v2/" | Set-Content -Encoding utf8 backups\tv_api_v2_baseline.json
& $sdb -s $dev capability | Set-Content -Encoding utf8 backups\sdb_capability_baseline.txt
& $sdb -s $dev shell 0 applist | Set-Content -Encoding utf8 backups\applist_baseline.txt

$lines = foreach ($f in 'tv_api_v2_baseline.json', 'sdb_capability_baseline.txt', 'applist_baseline.txt') {
    "$((Get-FileHash backups\$f -Algorithm SHA256).Hash.ToLower())  $f"
}
[IO.File]::WriteAllText((Join-Path $root 'backups\manifest.sha256'), ($lines -join "`n") + "`n")
Get-ChildItem backups -File | Select-Object Name, Length | Format-Table -AutoSize
Write-Host "Baseline saved. Also add a phone photo of Smart Hub as backups\screenshots\01_baseline_smarthub.jpg"
