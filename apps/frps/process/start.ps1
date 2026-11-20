. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'frp.ps1')
Stop-AppProcess $Bin
& $Bin -c $Conf
exit $LASTEXITCODE
