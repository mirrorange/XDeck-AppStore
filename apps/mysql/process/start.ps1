. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mysql.ps1')
Stop-AppProcess $Mysqld
& $Mysqld "--defaults-file=$Cnf" --console
exit $LASTEXITCODE
