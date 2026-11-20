. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'cloudflared.ps1')
if (Test-DeleteData) {
    Write-Step 'Deleting the token and options'
    if (Test-Path $ConfDir) { Remove-Item -Recurse -Force $ConfDir }
}
