. (Join-Path $PSScriptRoot 'lib.ps1')
$state = Get-State
Stop-AppProcess $state.exe
$prefix = (ConvertTo-SlashPath $AppDir) + '/'
& $state.exe -p $prefix -c conf/nginx.conf -e stderr -g 'daemon off;'
exit $LASTEXITCODE
