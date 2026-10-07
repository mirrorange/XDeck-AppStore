# Download the official nginx build for Windows from nginx.org.
. (Join-Path $PSScriptRoot 'lib.ps1')

$Version = '1.30.5'
$Sha256 = 'e5afe28b6a50bec92c478bfe1a4d3758206b80fb77159277bc5c4e88955c2a35'
$dist = Join-Path $AppDir 'nginx'
$exe = Join-Path $dist 'nginx.exe'

$state = if (Test-Path $StateFile) { Get-State } else { $null }
if (-not (Test-Path $exe) -or -not $state -or $state.version -ne $Version) {
    $zip = Join-Path $AppDir "downloads\nginx-$Version.zip"
    Invoke-Download "https://nginx.org/download/nginx-$Version.zip" $zip
    Assert-Sha256 $zip $Sha256
    Expand-Into $zip $dist
    Remove-Item -Force $zip
}

Set-State 'version' $Version
Set-State 'exe' $exe
foreach ($d in 'conf\sites', 'html', 'temp', 'logs') {
    New-Item -ItemType Directory -Force -Path (Join-Path $AppDir $d) | Out-Null
}
Write-Step "Using nginx $Version"
