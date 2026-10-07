# Write conf/mongod.conf from the app's settings.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mongodb.ps1')
Write-Conf
Write-Step 'Wrote conf/mongod.conf'
