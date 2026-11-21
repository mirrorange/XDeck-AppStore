# Set the administrator's password and the listen address in data\config.json.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'openlist.ps1')

if (-not $env:ADMIN_PASSWORD) { Stop-WithError 'an administrator password is required' }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# The first run creates config.json, the database and the administrator. The
# command prints the password: keep it out of the log.
$env:OPENLIST_ADMIN_PASSWORD = $env:ADMIN_PASSWORD
$ErrorActionPreference = 'Continue'
& $Bin admin set $env:ADMIN_PASSWORD --data $DataDir 2>$null | Out-Null
$admin = & $Bin admin --data $DataDir 2>$null
$ErrorActionPreference = 'Stop'
Remove-Item Env:OPENLIST_ADMIN_PASSWORD
if (-not ($admin | Select-String 'username: admin')) { Stop-WithError "could not set the administrator's password" }
Write-Step "Set the administrator's password"

# Only the listen address and port; other changes to config.json stay.
$port = if ($env:PORT) { $env:PORT } else { '5244' }
$bind = if ($env:BIND) { $env:BIND } else { '0.0.0.0' }
$text = [IO.File]::ReadAllText($Conf)
$text = $text -replace '"http_port":\s*-?\d+', "`"http_port`": $port"
$text = $text -replace '"address":\s*"[^"]*"', "`"address`": `"$bind`""
Write-TextFile $Conf $text
Write-Step "Listening on ${bind}:$port"
