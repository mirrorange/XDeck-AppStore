. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'rclone.ps1')
if (Test-DeleteData) {
    Write-Step 'Deleting the remotes and the cache'
    foreach ($dir in @($ConfDir, $CacheDir)) {
        if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
    }
}
