# Build the public mirror of this project in a separate folder, with no personal or device data.
# Usage (maintainer, from the private working copy): .\scripts\export_public.ps1 [-Dest ..\Tizen3-Clean-Launcher]
# Then commit/push in -Dest. The private repo is never modified or pushed by this script.
param([string]$Dest = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'Tizen3-Clean-Launcher'))
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Never exported: device snapshots, private notes, the deny-list itself, the historical plan (has a serial number).
$exclude = '^(backups/|_ref/|docs/PRIVATE_NOTES\.md$|docs/original-plan\.md$|\.export-denylist$)'
$files = git ls-files --cached --others --exclude-standard | Where-Object { $_ -notmatch $exclude } | Sort-Object -Unique

New-Item -ItemType Directory -Force $Dest | Out-Null
Get-ChildItem $Dest -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $to = Join-Path $Dest $f
    New-Item -ItemType Directory -Force (Split-Path -Parent $to) | Out-Null
    Copy-Item $f $to -Force
}

# Public .gitignore: also keep personal snapshots out.
Add-Content -Encoding ascii (Join-Path $Dest '.gitignore') "`n# your own TV snapshot identifies your TV and Wi-Fi: never publish it`nbackups/`n"

# MIT licence for the project's own code; third-party assets keep their own terms.
$year = (Get-Date).Year
@"
MIT License

Copyright (c) $year drak905 and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@ | Set-Content -Encoding ascii (Join-Path $Dest 'LICENSE')

# Third-party terms live in NOTICE.md so GitHub recognises LICENSE as plain MIT.
$notice = @(
    '# Notices', '',
    'The MIT licence in `LICENSE` covers this project''s own code and documentation.', '',
    'Third-party material keeps its own terms (texts and source records in `launcher/licenses/`):', '',
    '| Material | Source | Licence |',
    '|---|---|---|',
    '| Design, pre-rendered glass, icon metrics | [CleanFrame](https://github.com/nthnclrk/CleanFrame) by Nathan Clark | MIT |',
    '| Wallpaper photographs | Unsplash photographers credited in `launcher/licenses/photo-sources.json` | Unsplash License |',
    '| Brand icons (YouTube, Netflix, Apple TV, Spotify) | [Simple Icons](https://simpleicons.org) | CC0 1.0 |',
    '| Manrope font (static instances) | Manrope by Mikhail Sharanda | SIL OFL 1.1 |', '',
    'Brand marks identify services and belong to their owners; this project is not affiliated with Samsung, Apple or any streaming service.'
)
[IO.File]::WriteAllText((Join-Path $Dest 'NOTICE.md'), ($notice -join "`n") + "`n")

# Leak check over every text file in the export.
$deny = @()
if (Test-Path .export-denylist) { $deny = Get-Content .export-denylist | Where-Object { $_ -and -not $_.StartsWith('#') } }
$generic = @{
    'MAC address'  = '\b([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b'
    'private IPv4' = '\b(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b'
    'UUID'         = '\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'
    'private key'  = 'BEGIN [A-Z ]*PRIVATE KEY'
}
$binary = '\.(jpg|jpeg|png|ttf|woff2?|ico|wgt|exe)$'
$problems = @()
Get-ChildItem $Dest -Recurse -File -Force | Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.Name -notmatch $binary } | ForEach-Object {
    $rel = $_.FullName.Substring($Dest.Length + 1)
    $text = [IO.File]::ReadAllText($_.FullName)
    foreach ($d in $deny) { if ($text.Contains($d)) { $problems += "$rel : contains a deny-listed string" } }
    foreach ($k in $generic.Keys) {
        foreach ($m in [regex]::Matches($text, $generic[$k])) {
            if ($k -eq 'UUID' -and $m.Value -eq '00000000-0000-0000-0000-000000000000') { continue }
            $problems += "$rel : $k '$($m.Value)'"
        }
    }
}
# Images: refuse EXIF/GPS blocks (camera photos could carry location).
Get-ChildItem $Dest -Recurse -File -Include *.jpg, *.jpeg | ForEach-Object {
    $head = [IO.File]::ReadAllBytes($_.FullName) | Select-Object -First 4096
    if ([Text.Encoding]::ASCII.GetString([byte[]]$head) -match 'Exif') { $problems += "$($_.Name) : has EXIF metadata" }
}
if ($problems) { $problems | Sort-Object -Unique | ForEach-Object { Write-Host "LEAK? $_" -ForegroundColor Red }; throw 'Export blocked: fix the items above.' }
Write-Host "Exported $($files.Count) files + LICENSE to $Dest; leak check passed."
