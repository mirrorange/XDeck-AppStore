# Download the official rclone build into the app directory.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'rclone.ps1')
Install-Rclone
Write-Step "Using $(& $Bin version | Select-Object -First 1)"
New-Item -ItemType Directory -Force -Path $ConfDir, $CacheDir | Out-Null
# Remotes are created through the remote control; start from an empty configuration.
if (-not (Test-Path $Conf)) { Write-TextFile $Conf '' }
