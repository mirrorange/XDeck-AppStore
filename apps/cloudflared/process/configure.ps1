# Keep the token in a file the app reads, and the options next to it.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'cloudflared.ps1')

if (-not $env:TUNNEL_TOKEN) { Stop-WithError 'a tunnel token is required' }
Write-TextFile (Join-Path $ConfDir 'token') $env:TUNNEL_TOKEN
$options = @{
    protocol = if ($env:PROTOCOL) { $env:PROTOCOL } else { 'auto' }
    metrics_port = if ($env:METRICS_PORT) { $env:METRICS_PORT } else { '20241' }
}
Write-TextFile (Join-Path $ConfDir 'options.json') ($options | ConvertTo-Json)
Write-Step 'Wrote the tunnel token and options'
