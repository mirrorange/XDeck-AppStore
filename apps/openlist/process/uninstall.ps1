. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'openlist.ps1')
if (Test-DeleteData) {
    Write-Step 'Deleting data\'
    if (Test-Path $DataDir) { Remove-Item -Recurse -Force $DataDir }
}
