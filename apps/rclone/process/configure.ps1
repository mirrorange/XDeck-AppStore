# Keep the remote control's port and password where only the app reads them.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'rclone.ps1')
if (-not $env:RC_PASSWORD) { Stop-WithError 'a password is required' }
$port = if ($env:RC_PORT) { $env:RC_PORT } else { '5572' }
Write-TextFile $RcFile (@{ port = $port; password = $env:RC_PASSWORD } | ConvertTo-Json)
Write-Step 'Wrote the remote control settings'
