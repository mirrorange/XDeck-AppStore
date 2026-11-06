# Stop leftover workers and delete the app's files when asked to.
. (Join-Path $PSScriptRoot 'lib.ps1')
Stop-AppProcess (Join-Path $AppDir 'nginx\nginx.exe')
if (Test-DeleteData) {
    Write-Step 'Deleting the configuration, websites and logs'
    foreach ($d in 'html', 'conf', 'conf.d', 'sites', 'ssl', 'www', 'acme', 'logs', 'temp', 'run', 'nginx.conf', 'mime.types') {
        $p = Join-Path $AppDir $d
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}
