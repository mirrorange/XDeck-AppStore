# Stop leftover workers and delete the app's files when asked to.
. (Join-Path $PSScriptRoot 'lib.ps1')
Stop-AppProcess (Join-Path $AppDir 'nginx\nginx.exe')
if (Test-DeleteData) {
    Write-Step 'Deleting html/ and conf/'
    foreach ($d in 'html', 'conf', 'temp', 'logs') {
        $p = Join-Path $AppDir $d
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}
