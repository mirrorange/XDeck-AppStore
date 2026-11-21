# rclone helpers shared by this app's Windows scripts (after lib.ps1).

$RcloneVersion = '1.76.0'
$RcloneDir = Join-Path $AppDir 'rclone'
$Bin = Join-Path $RcloneDir 'rclone.exe'
$ConfDir = Join-Path $AppDir 'conf'
$Conf = Join-Path $ConfDir 'rclone.conf'
$RcFile = Join-Path $ConfDir 'rc.json'
$CacheDir = Join-Path $AppDir 'cache'

function Get-PinnedSha256([string]$File) {
    foreach ($line in Get-Content (Join-Path $PSScriptRoot 'checksums.txt')) {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 2 -and $parts[1] -eq $File) { return $parts[0] }
    }
    Stop-WithError "no checksum for $File"
}

# Download rclone for this system unless this version is there already.
function Install-Rclone {
    $cpu = if ($env:XDECK_ARCH -eq 'aarch64') { 'arm64' } else { 'amd64' }
    $file = "rclone-v$RcloneVersion-windows-$cpu.zip"
    $state = if (Test-Path $StateFile) { Get-State } else { $null }
    if ((Test-Path $Bin) -and $state -and $state.rclone -eq $RcloneVersion) { return }
    $downloads = Join-Path $AppDir 'downloads'
    Invoke-Download "https://github.com/rclone/rclone/releases/download/v$RcloneVersion/$file" (Join-Path $downloads $file)
    Assert-Sha256 (Join-Path $downloads $file) (Get-PinnedSha256 $file)
    Write-Step "Extracting $file"
    Stop-AppProcess $Bin
    Expand-Into (Join-Path $downloads $file) $RcloneDir
    Remove-Item -Recurse -Force $downloads
    Set-State 'rclone' $RcloneVersion
}
