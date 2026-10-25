# Master rollback for a Samsung Tizen 3.0 TV - Windows PowerShell
# Usage: $env:TV_IP = '<TV address>'; .\scripts\restore_tv.ps1 [-DryRun]
# Verifies the baseline backups (made by scripts\backup_tv.ps1), uninstalls the launcher, and checks that
# the TV's app list is back to the baseline. Never uninstalls anything except AppleTVDoc.
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$tv  = if ($env:TV_IP) { $env:TV_IP } elseif ($DryRun) { '<TV_IP>' } else { throw 'Set $env:TV_IP to the TV address first' }
$sdb = if ($env:SDB_BIN) { $env:SDB_BIN } else { '.\tools\sdb.exe' }
$dev = "${tv}:26101"
$haveBackup = Test-Path backups\manifest.sha256

Write-Host "=== [1/3] Verifying baseline backup SHA-256 checksums ==="
if ($haveBackup) {
    Get-Content backups\manifest.sha256 | Where-Object { $_.Trim() } | ForEach-Object {
        $hash, $file = $_ -split '\s+', 2
        $actual = (Get-FileHash (Join-Path backups $file.Trim()) -Algorithm SHA256).Hash.ToLower()
        if ($actual -ne $hash) { throw "SHA-256 mismatch for $file" }
        Write-Host "OK  $file"
    }
} else {
    Write-Host "No backups\manifest.sha256 (run scripts\backup_tv.ps1 before changing the TV). Skipping checks."
}

Write-Host "=== [2/3] Removing sideloaded AppleTVDock launcher via SDB ==="
if ($DryRun) {
    Write-Host "[DRY-RUN] Would run: $sdb -s $dev uninstall AppleTVDoc"
} else {
    & $sdb connect $dev | Out-Null
    if ((& $sdb -s $dev shell 0 applist) -match 'AppleTVDoc') { & $sdb -s $dev uninstall AppleTVDoc }
}

Write-Host "=== [3/3] Diffing current TV applist against baseline ==="
if (-not $DryRun -and $haveBackup) {
    & $sdb -s $dev shell 0 applist | Set-Content -Encoding utf8 backups\applist_post_restore.txt
    $norm = { param($f) Get-Content $f | Where-Object { $_.Trim() } | ForEach-Object { $_.TrimEnd() } }
    $diff = Compare-Object (& $norm backups\applist_baseline.txt) (& $norm backups\applist_post_restore.txt)
    if ($diff) { $diff | Format-Table -AutoSize; throw "applist differs from baseline" }
    Write-Host "SUCCESS: live applist matches backups\applist_baseline.txt"
} elseif (-not $haveBackup) {
    Write-Host "No baseline to compare against."
}

@"

Manual TV remote restore checklist:
1. DNS: Settings -> General -> Network -> Network Status -> IP Settings -> DNS Setting -> Get automatically.
2. Autorun: Settings -> General -> Smart Features -> Autorun Smart Hub ON, Autorun Last App OFF.
3. Privacy: re-enable Viewing Information Services / Interest-Based Ads if desired.
4. Developer Mode OFF: Apps -> 12345 -> Developer mode Off -> power-cycle TV.
"@ | Write-Host
