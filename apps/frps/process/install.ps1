# Download the official frp build into the app directory.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'frp.ps1')
Install-Frp
Write-Step "Using frps $(& $Bin --version)"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Conf) | Out-Null
