# Cloudflared helpers shared by this app's Windows scripts (after lib.ps1).

$CloudflaredVersion = '2026.11.1'
$Bin = Join-Path $AppDir 'bin\cloudflared.exe'
$ConfDir = Join-Path $AppDir 'conf'
$ReleaseFile = 'cloudflared-windows-amd64.exe'
$ReleaseSha256 = '341deda3db5ec498a0482254d6c38c0b7cf01a30c37bb5dd95d2216d08955e35'
