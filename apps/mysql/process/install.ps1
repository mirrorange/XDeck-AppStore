# Download the official MySQL build into mysql\ and initialize data\ with
# the configured root password, database and user.
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'mysql.ps1')

$state = if (Test-Path $StateFile) { Get-State } else { $null }
if (-not (Test-Path $Mysqld) -or -not $state -or $state.version -ne $MysqlVersion) {
    $file = "mysql-$MysqlVersion-winx64.zip"
    $zip = Join-Path $AppDir "downloads\$file"
    Invoke-Download "https://dev.mysql.com/get/Downloads/MySQL-8.4/$file" $zip
    Assert-Sha256 $zip $MysqlSha256
    Write-Step "Extracting $file"
    Expand-Into $zip $DistDir
    Remove-Item -Recurse -Force (Join-Path $AppDir 'downloads')
    Set-State 'version' $MysqlVersion
}
Write-Step "Using $(& $Mysqld --version)"

Write-Cnf
if (Test-Path (Join-Path $DataDir 'mysql')) {
    Write-Step 'Keeping the existing data in data\'
    exit 0
}

Write-Step 'Initializing data\'
if (Test-Path $DataDir) { Remove-Item -Recurse -Force $DataDir }
Invoke-Native $Mysqld @("--defaults-file=$Cnf", '--initialize-insecure', '--console')

# A temporary server on the loopback interface applies the settings.
$port = if ($env:PORT) { [int]$env:PORT } else { 3306 }
$server = Start-Process -FilePath $Mysqld -PassThru -NoNewWindow -ArgumentList @(
    "--defaults-file=`"$Cnf`"", '--bind-address=127.0.0.1', "--port=$port", '--console'
)
try {
    if (-not (Wait-Port '127.0.0.1' $port 90)) { Stop-WithError 'the setup server did not start' }
    $root = ConvertTo-SqlString $env:MYSQL_ROOT_PASSWORD
    $sql = @(
        "ALTER USER 'root'@'localhost' IDENTIFIED BY $root;",
        "CREATE USER 'root'@'%' IDENTIFIED BY $root;",
        "GRANT ALL ON *.* TO 'root'@'%' WITH GRANT OPTION;"
    )
    if ($env:MYSQL_DATABASE) {
        $sql += "CREATE DATABASE IF NOT EXISTS $(ConvertTo-SqlIdent $env:MYSQL_DATABASE);"
    }
    if ($env:MYSQL_USER) {
        if ($env:MYSQL_USER -eq 'root') { Stop-WithError 'MYSQL_USER cannot be root' }
        $user = ConvertTo-SqlString $env:MYSQL_USER
        $sql += "CREATE USER $user@'%' IDENTIFIED BY $(ConvertTo-SqlString $env:MYSQL_PASSWORD);"
        if ($env:MYSQL_DATABASE) {
            $sql += "GRANT ALL ON $(ConvertTo-SqlIdent $env:MYSQL_DATABASE).* TO $user@'%';"
        }
    }
    $sql += 'SHUTDOWN;'
    $mysql = Join-Path $DistDir 'bin\mysql.exe'
    ($sql -join "`n") | & $mysql --no-defaults -h127.0.0.1 "-P$port" -uroot
    if ($LASTEXITCODE -ne 0) { Stop-WithError "mysql exited with code $LASTEXITCODE" }
    $server.WaitForExit(60000) | Out-Null
} finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
Write-Step 'Initialized data\'
