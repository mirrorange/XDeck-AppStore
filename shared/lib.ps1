# Shared helpers for App Store process scripts on Windows (PowerShell 5.1+).
#
# Synced into apps/*/process/lib.ps1 by `pnpm sync-shared`; edit this copy.
# Dot-source it first: . (Join-Path $PSScriptRoot 'lib.ps1')

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $env:XDECK_APP_DIR) { throw 'XDECK_APP_DIR is not set' }
$AppDir = $env:XDECK_APP_DIR
$StateFile = Join-Path $AppDir '.state.json'

function Write-Step([string]$Message) { Write-Output "==> $Message" }

function Stop-WithError([string]$Message) {
    [Console]::Error.WriteLine("error: $Message")
    exit 1
}

# ---- state ------------------------------------------------------------------

function Get-State {
    if (-not (Test-Path $StateFile)) { Stop-WithError "$StateFile is missing; reinstall the app" }
    Get-Content -Raw $StateFile | ConvertFrom-Json
}

function Set-State([string]$Key, [string]$Value) {
    $state = @{}
    if (Test-Path $StateFile) {
        (Get-Content -Raw $StateFile | ConvertFrom-Json).PSObject.Properties |
            ForEach-Object { $state[$_.Name] = $_.Value }
    }
    $state[$Key] = $Value
    Write-TextFile $StateFile ($state | ConvertTo-Json)
}

# ---- files ------------------------------------------------------------------

# UTF-8 without a byte order mark (Set-Content adds one on PowerShell 5.1).
function Write-TextFile([string]$Path, [string]$Text) {
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = "$Path.tmp"
    [IO.File]::WriteAllText($tmp, $Text, (New-Object Text.UTF8Encoding $false))
    Move-Item -Force $tmp $Path
}

function Invoke-Download([string]$Url, [string]$Destination) {
    Write-Step "Downloading $Url"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
    $part = "$Destination.part"
    for ($i = 1; ; $i++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $part
            break
        } catch {
            if ($i -ge 3) { throw }
            Start-Sleep -Seconds 2
        }
    }
    Move-Item -Force $part $Destination
}

function Assert-Sha256([string]$Path, [string]$Expected) {
    $actual = (Get-FileHash -Algorithm SHA256 $Path).Hash.ToLower()
    if ($actual -ne $Expected.ToLower()) {
        Stop-WithError "$(Split-Path -Leaf $Path): SHA-256 mismatch (got $actual)"
    }
}

# Extract a zip into a directory, dropping its top-level folder.
function Expand-Into([string]$Archive, [string]$Destination) {
    $tmp = "$Destination.extract"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Path $Archive -DestinationPath $tmp
    if (Test-Path $Destination) { Remove-Item -Recurse -Force $Destination }
    $items = @(Get-ChildItem $tmp)
    if ($items.Count -eq 1 -and $items[0].PSIsContainer) {
        Move-Item $items[0].FullName $Destination
        Remove-Item -Force $tmp
    } else {
        Move-Item $tmp $Destination
    }
}

# Forward slashes: accepted by Windows and by the servers' config parsers.
function ConvertTo-SlashPath([string]$Path) { $Path -replace '\\', '/' }

# ---- services ---------------------------------------------------------------

function Wait-Port([string]$HostName, [int]$Port, [int]$Seconds = 60) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        $client = New-Object Net.Sockets.TcpClient
        try {
            $client.Connect($HostName, $Port)
            return $true
        } catch {
            Start-Sleep -Seconds 1
        } finally {
            $client.Dispose()
        }
    }
    return $false
}

function Get-ClientHost([string]$Bind) {
    if (-not $Bind -or $Bind -eq '0.0.0.0') { return '127.0.0.1' }
    return $Bind
}

# Run a native program; fail when it exits non-zero.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { Stop-WithError "$(Split-Path -Leaf $Exe) exited with code $LASTEXITCODE" }
}

# Stop processes started from an executable of this app (a previous run whose
# children outlived the supervised PowerShell host).
function Stop-AppProcess([string]$Exe) {
    $name = [IO.Path]::GetFileNameWithoutExtension($Exe)
    Get-Process $name -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $Exe } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Test-DeleteData { $env:XDECK_DELETE_DATA -eq '1' }
