# frp helpers shared by this app's Windows scripts (after lib.ps1).

$FrpVersion = '0.72.0'
$FrpDir = Join-Path $AppDir 'frp'
$Bin = Join-Path $FrpDir 'frpc.exe'
$Conf = Join-Path $AppDir 'conf\frpc.toml'

function Get-PinnedSha256([string]$File) {
    foreach ($line in Get-Content (Join-Path $PSScriptRoot 'checksums.txt')) {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 2 -and $parts[1] -eq $File) { return $parts[0] }
    }
    Stop-WithError "no checksum for $File"
}

# Download frp for this system unless this version is there already.
function Install-Frp {
    $cpu = if ($env:XDECK_ARCH -eq 'aarch64') { 'arm64' } else { 'amd64' }
    $file = "frp_${FrpVersion}_windows_$cpu.zip"
    $state = if (Test-Path $StateFile) { Get-State } else { $null }
    if ((Test-Path $Bin) -and $state -and $state.frp -eq $FrpVersion) { return }
    $downloads = Join-Path $AppDir 'downloads'
    Invoke-Download "https://github.com/fatedier/frp/releases/download/v$FrpVersion/$file" (Join-Path $downloads $file)
    Assert-Sha256 (Join-Path $downloads $file) (Get-PinnedSha256 $file)
    Write-Step "Extracting $file"
    Stop-AppProcess $Bin
    Expand-Into (Join-Path $downloads $file) $FrpDir
    Remove-Item -Recurse -Force $downloads
    Set-State 'frp' $FrpVersion
}

# A TOML string.
function ConvertTo-TomlString([string]$Value) {
    '"' + ($Value -replace '\\', '\\' -replace '"', '\"') + '"'
}
