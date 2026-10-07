# Write conf/my.ini from the app's settings.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mysql.ps1')
Write-Cnf
Write-Step 'Wrote conf/my.ini'
