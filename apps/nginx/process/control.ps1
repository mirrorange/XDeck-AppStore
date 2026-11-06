# Actions XDeck runs to manage websites ($env:XDECK_ACTION): test the
# configuration, reload it, print the version.
. (Join-Path $PSScriptRoot 'lib.ps1')
$state = Get-State
$prefix = (ConvertTo-SlashPath $AppDir) + '/'
$flags = @('-p', $prefix, '-c', 'nginx.conf', '-e', 'stderr')
switch ($env:XDECK_ACTION) {
    'test' { Invoke-Native $state.exe ($flags + '-t') }
    'reload' { Invoke-Native $state.exe ($flags + @('-s', 'reload')) }
    'version' { Invoke-Native $state.exe @('-v') }
    default { Stop-WithError "unknown action: $($env:XDECK_ACTION)" }
}
