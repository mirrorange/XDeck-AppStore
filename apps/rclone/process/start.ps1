# The remote control only: XDeck creates remotes and mounts through it.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'rclone.ps1')
$rc = Get-Content -Raw $RcFile | ConvertFrom-Json
Stop-AppProcess $Bin
# The password goes through the environment, not the command line.
$env:RCLONE_RC_USER = 'xdeck'
$env:RCLONE_RC_PASS = $rc.password
& $Bin rcd --rc-addr "127.0.0.1:$($rc.port)" --config $Conf --cache-dir $CacheDir
exit $LASTEXITCODE
