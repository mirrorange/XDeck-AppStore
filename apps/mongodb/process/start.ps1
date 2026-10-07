. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mongodb.ps1')
Stop-AppProcess $Mongod
& $Mongod --config $Conf
exit $LASTEXITCODE
