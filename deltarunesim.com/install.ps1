# DELTARUNE Fight Simulator - quick installer for the desktop app (Windows PowerShell).
#   irm https://deltarunesim.com/install.ps1 | iex
# Reads the app's update feed (/desktop/latest.json), downloads the installer it names from
# deltarunesim.com, checks its SHA-256 against /desktop/SHA256SUMS, and runs it (per user, no admin).
$ErrorActionPreference = 'Stop'
$site = 'https://deltarunesim.com'
$feed = Invoke-RestMethod "$site/desktop/latest.json"
$url = $feed.platforms.'windows-x86_64'.url
if ($url -notlike "$site/desktop/*.exe") { throw "unexpected installer address: $url" }
$name = Split-Path $url -Leaf
$raw = (Invoke-WebRequest "$site/desktop/SHA256SUMS" -UseBasicParsing).Content
if ($raw -is [byte[]]) { $raw = [Text.Encoding]::UTF8.GetString($raw) }
$want = $null
foreach ($line in ($raw -split "`r?`n")) {
  $parts = $line.Trim() -split '\s+'
  if ($parts.Count -ge 2 -and $parts[1].TrimStart('*') -eq $name) { $want = $parts[0]; break }
}
if (-not $want) { throw "no checksum listed for $name" }
$tmp = Join-Path $env:TEMP $name
Write-Host "Downloading DELTARUNE Fight Simulator $($feed.version)..."
Invoke-WebRequest "$site/api/dl?f=setup&src=ps1" -OutFile $tmp -UseBasicParsing
$got = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
if ($got -ne $want.ToLower()) { Remove-Item $tmp -Force; throw "checksum mismatch ($got) - not running it" }
Write-Host "Checksum OK ($want)"
Write-Host 'Installing...'
Start-Process -Wait -FilePath $tmp
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Host 'Done. The app opens on its own; next time, start it from the Start menu.'
