# Download the official OpenList build into the app directory.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'openlist.ps1')
Install-OpenList
$version = (& $Bin version | Select-String '^Version:') -replace '^Version:\s*', ''
Write-Step "Using OpenList $version"
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
