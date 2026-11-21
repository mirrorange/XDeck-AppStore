# OpenList helpers shared by this app's Windows scripts (after lib.ps1).

$OpenListVersion = '4.2.10'
$Bin = Join-Path $AppDir 'openlist\openlist.exe'
$DataDir = Join-Path $AppDir 'data'
$Conf = Join-Path $DataDir 'config.json'

function Get-PinnedSha256([string]$File) {
    foreach ($line in Get-Content (Join-Path $PSScriptRoot 'checksums.txt')) {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 2 -and $parts[1] -eq $File) { return $parts[0] }
    }
    Stop-WithError "no checksum for $File"
}

# Download OpenList for this system unless this version is there already.
function Install-OpenList {
    $cpu = if ($env:XDECK_ARCH -eq 'aarch64') { 'arm64' } else { 'amd64' }
    $file = "openlist-windows-$cpu.zip"
    $state = if (Test-Path $StateFile) { Get-State } else { $null }
    if ((Test-Path $Bin) -and $state -and $state.openlist -eq $OpenListVersion) { return }
    $downloads = Join-Path $AppDir 'downloads'
    Invoke-Download "https://github.com/OpenListTeam/OpenList/releases/download/v$OpenListVersion/$file" (Join-Path $downloads $file)
    Assert-Sha256 (Join-Path $downloads $file) (Get-PinnedSha256 $file)
    Write-Step "Extracting $file"
    Stop-AppProcess $Bin
    Expand-Into (Join-Path $downloads $file) (Split-Path -Parent $Bin)
    Remove-Item -Recurse -Force $downloads
    Set-State 'openlist' $OpenListVersion
}
