# Download the official cloudflared build into the app directory.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'cloudflared.ps1')

if ($env:XDECK_ARCH -ne 'x86_64') { Stop-WithError 'cloudflared is built for x86-64 Windows only' }
$state = if (Test-Path $StateFile) { Get-State } else { $null }
if (-not (Test-Path $Bin) -or -not $state -or $state.cloudflared -ne $CloudflaredVersion) {
    $downloads = Join-Path $AppDir 'downloads'
    $file = Join-Path $downloads $ReleaseFile
    Invoke-Download "https://github.com/cloudflare/cloudflared/releases/download/$CloudflaredVersion/$ReleaseFile" $file
    Assert-Sha256 $file $ReleaseSha256
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Bin) | Out-Null
    Stop-AppProcess $Bin
    Move-Item -Force $file $Bin
    Remove-Item -Recurse -Force $downloads
    Set-State 'cloudflared' $CloudflaredVersion
}
Write-Step "Using $(& $Bin --version)"
New-Item -ItemType Directory -Force -Path $ConfDir | Out-Null
