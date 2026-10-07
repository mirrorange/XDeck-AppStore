# Download the official MongoDB build and mongosh into the app directory and
# create the root user in data\.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mongodb.ps1')

$state = if (Test-Path $StateFile) { Get-State } else { $null }
$downloads = Join-Path $AppDir 'downloads'
if (-not (Test-Path $Mongod) -or -not $state -or $state.mongodb -ne $MongoVersion) {
    $file = "mongodb-windows-x86_64-$MongoVersion.zip"
    Invoke-Download "https://fastdl.mongodb.org/windows/$file" (Join-Path $downloads $file)
    Assert-Sha256 (Join-Path $downloads $file) (Get-PinnedSha256 $file)
    Write-Step "Extracting $file"
    Expand-Into (Join-Path $downloads $file) $DistDir
    Set-State 'mongodb' $MongoVersion
}
$mongosh = Join-Path $ShellDir 'bin\mongosh.exe'
if (-not (Test-Path $mongosh) -or -not $state -or $state.mongosh -ne $MongoshVersion) {
    $file = "mongosh-$MongoshVersion-win32-x64.zip"
    Invoke-Download "https://downloads.mongodb.com/compass/$file" (Join-Path $downloads $file)
    Assert-Sha256 (Join-Path $downloads $file) (Get-PinnedSha256 $file)
    Expand-Into (Join-Path $downloads $file) $ShellDir
    Set-State 'mongosh' $MongoshVersion
}
if (Test-Path $downloads) { Remove-Item -Recurse -Force $downloads }
Write-Step "Using $(& $Mongod --version | Select-Object -First 1)"

Write-Conf
if ((Test-Path $DataDir) -and (Get-ChildItem $DataDir | Select-Object -First 1)) {
    Write-Step 'Keeping the existing data in data\'
    exit 0
}

Write-Step 'Creating the root user'
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$port = if ($env:PORT) { [int]$env:PORT } else { 27017 }
# A temporary server on the loopback interface, without access control.
$server = Start-Process -FilePath $Mongod -PassThru -NoNewWindow -ArgumentList @(
    '--dbpath', "`"$DataDir`"", '--bind_ip', '127.0.0.1', '--port', "$port", '--quiet'
)
try {
    if (-not (Wait-Port '127.0.0.1' $port 60)) { Stop-WithError 'the setup server did not start' }
    if (-not $env:MONGO_USERNAME) { $env:MONGO_USERNAME = 'root' }
    # The credentials stay in the environment, out of the command line.
    $script = 'db.createUser({ user: process.env.MONGO_USERNAME, pwd: process.env.MONGO_PASSWORD, roles: [{ role: "root", db: "admin" }] }); try { db.shutdownServer(); } catch (e) {}'
    Invoke-Native $mongosh @('--quiet', "mongodb://127.0.0.1:$port/admin", '--eval', $script)
    $server.WaitForExit(60000) | Out-Null
} finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
Write-Step "Created user $env:MONGO_USERNAME"
