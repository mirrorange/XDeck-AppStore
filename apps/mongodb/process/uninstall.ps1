# MongoDB and mongosh live in the app directory; data\ goes only when asked.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mongodb.ps1')
Stop-AppProcess $Mongod
foreach ($d in $DistDir, $ShellDir) {
    if (Test-Path $d) { Remove-Item -Recurse -Force $d }
}
if (Test-DeleteData) {
    Write-Step 'Deleting data\'
    foreach ($d in 'data', 'conf') {
        $p = Join-Path $AppDir $d
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}
