# Package, sign, install and open the launcher on the TV.
# Usage: .\scripts\deploy.ps1 [-TvIp <TV_IP>]   (or set $env:TV_IP) [-Profile appletv] [-NoLaunch]
# Needs: Developer Mode ON on the TV with this PC's IP as Host PC IP, Tizen CLI SDK at
# $env:USERPROFILE\tizen-studio, and the Samsung signing profile (see README "Signing").
param(
    [string]$TvIp = $env:TV_IP,
    [string]$Profile = 'appletv',
    [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'
if (-not $TvIp) { throw 'Pass -TvIp <TV address> or set $env:TV_IP' }
$root = Split-Path -Parent $PSScriptRoot
$sdkTools = Join-Path $env:USERPROFILE 'tizen-studio\tools'
$env:PATH = "$sdkTools\ide\bin;$sdkTools;$env:PATH"
$sdb = Join-Path $root 'tools\sdb.exe'
if (-not (Test-Path $sdb)) { $sdb = Join-Path $sdkTools 'sdb.exe' }
$dev = "${TvIp}:26101"
$appId = 'AppleTVDoc.AppleTVDock'
Set-Location $root

Write-Host "== connect $dev"
& $sdb connect $dev | Out-Host
if (-not ((& $sdb devices) -match [regex]::Escape($dev))) { throw "TV not connected over SDB (Developer Mode on? Host PC IP correct?)" }

Write-Host "== package + sign (profile $Profile)"
# `tizen package` writes the .wgt next to the CLI, not to -o, and leaves signature files in the source.
$out = tizen package -t wgt -s $Profile -o build -- launcher 2>&1
$loc = ($out | Select-String 'Package File Location:\s*(.+)$').Matches.Groups[1].Value
if (-not $loc -or -not (Test-Path $loc)) { $out | Out-Host; throw 'packaging failed' }
New-Item -ItemType Directory -Force build | Out-Null
Copy-Item $loc build\AppleTVDock.wgt -Force
Remove-Item launcher\.manifest.tmp -ErrorAction SilentlyContinue

Write-Host "== install"
tizen install-permit -s $dev | Out-Null          # without this the TV rejects the package (error 118)
$inst = tizen install -n AppleTVDock.wgt -s $dev -- build 2>&1
$inst | Select-Object -Last 3 | Out-Host
if (-not ($inst -match 'successfully installed')) { throw 'install failed' }

if (-not $NoLaunch) {
    Write-Host "== launch"
    & $sdb -s $dev shell 0 kill AppleTVDoc | Out-Null
    Start-Sleep 2
    & $sdb -s $dev shell 0 was_execute $appId | Select-String launched | Out-Host
}
