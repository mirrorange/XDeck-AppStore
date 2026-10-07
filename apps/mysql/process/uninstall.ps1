# The MySQL build lives in the app directory; data\ goes only when asked.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mysql.ps1')
Stop-AppProcess $Mysqld
if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
if (Test-DeleteData) {
    Write-Step 'Deleting data\'
    foreach ($d in 'data', 'conf', 'files') {
        $p = Join-Path $AppDir $d
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}
