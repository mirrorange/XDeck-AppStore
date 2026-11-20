. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'cloudflared.ps1')
$options = Get-Content -Raw (Join-Path $ConfDir 'options.json') | ConvertFrom-Json
Stop-AppProcess $Bin
& $Bin --no-autoupdate tunnel --protocol $options.protocol --metrics "127.0.0.1:$($options.metrics_port)" `
    run --token-file (Join-Path $ConfDir 'token')
exit $LASTEXITCODE
