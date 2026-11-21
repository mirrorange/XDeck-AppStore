. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'openlist.ps1')
Stop-AppProcess $Bin
& $Bin server --data $DataDir --log-std
exit $LASTEXITCODE
