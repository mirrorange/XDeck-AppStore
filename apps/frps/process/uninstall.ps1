. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'frp.ps1')
if (Test-DeleteData) {
    Write-Step 'Deleting the configuration'
    $dir = Split-Path -Parent $Conf
    if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
}
