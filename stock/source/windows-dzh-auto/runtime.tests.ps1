# Self-contained regression tests: mocked downloads, no real executables or login.
$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('dzh-runtime-test-'+[Guid]::NewGuid().ToString('N'))
$sourceRoot=$PSScriptRoot
New-Item -ItemType Directory -Path $root | Out-Null
$oldPath=$env:Path; $oldOs=$env:OS
function Assert($Condition,[string]$Message) { if (-not $Condition) { throw $Message } }
try {
    $client=Join-Path $root 'client'
    New-Item -ItemType Directory -Path $client | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'runtime.ps1') -Destination (Join-Path $client 'runtime.ps1')
    . (Join-Path $client 'runtime.ps1')
    Assert ((Convert-DzhWebText ([PSCustomObject]@{Content=[Text.Encoding]::UTF8.GetBytes('checksum text')})) -eq 'checksum text') 'Binary HTTP manifest decoding failed'
    $hash='a'*64
    Assert ((Get-DzhChecksum ($hash+' *node.zip') 'node.zip') -eq $hash) 'Star-prefixed checksum failed'
    Assert ((Get-DzhChecksum ($hash+'  gh.zip') 'gh.zip') -eq $hash) 'Two-space checksum failed'
    $rejected=$false;try { Get-DzhChecksum ($hash+'  other.zip') 'node.zip' } catch { $rejected=$true };Assert $rejected 'Missing checksum was accepted'
    $rejected=$false;try { Get-DzhWeb 'http://nodejs.org/test' } catch { $rejected=$true };Assert $rejected 'HTTP URL accepted'
    $rejected=$false;try { Get-DzhWeb 'https://example.invalid/test' } catch { $rejected=$true };Assert $rejected 'Unofficial URL accepted'
    $fixtureDir=Join-Path $root 'fixture'
    New-Item -ItemType Directory -Path $fixtureDir | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtureDir 'node.exe') -Value 'TEST NOT AN EXECUTABLE' -Encoding UTF8
    $script:FixtureZip=Join-Path $root 'fixture.zip'
    Compress-Archive -LiteralPath $fixtureDir -DestinationPath $script:FixtureZip
    $script:FixtureManifest=('0'*64)+'  fixture.zip'
    function Get-DzhWeb([string]$Uri) { return [PSCustomObject]@{Content=$script:FixtureManifest} }
    function Save-DzhDownload([string]$Uri,[string]$Path) { Copy-Item -LiteralPath $script:FixtureZip -Destination $Path -Force }
    $rejected=$false;try { Install-DzhPortable 'node' 'https://nodejs.org/fixture.zip' 'https://nodejs.org/manifest' 'fixture.zip' 'node.exe' } catch { Assert ($_.Exception.Message -match 'SHA256') 'Unexpected checksum failure';$rejected=$true }
    Assert $rejected 'Bad hash did not stop extraction'
    Assert (-not (Test-Path -LiteralPath (Join-Path $client 'runtime/node/node.exe'))) 'Bad-hash executable copied'
    $script:FixtureManifest=(Get-FileHash -LiteralPath $script:FixtureZip -Algorithm SHA256).Hash+'  fixture.zip'
    Install-DzhPortable 'node' 'https://nodejs.org/fixture.zip' 'https://nodejs.org/manifest' 'fixture.zip' 'node.exe'
    Assert (Test-Path -LiteralPath (Join-Path $client 'runtime/node/node.exe')) 'Verified portable file was not installed'
    # The fixture is never executed. Restore PATH before invoking the test subprocess.
    $env:Path=$oldPath
    $setupDir=Join-Path $root 'setup failure with spaces'
    New-Item -ItemType Directory -Path $setupDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'setup.ps1') -Destination (Join-Path $setupDir 'setup.ps1')
    Set-Content -LiteralPath (Join-Path $setupDir 'runtime.ps1') -Value "function Ensure-DzhNode { throw 'TEST dependency failure' }" -Encoding UTF8
    $env:OS='Windows_NT'
    $hostExe=Join-Path $PSHOME $(if ($IsWindows -or $env:ComSpec) { 'powershell.exe' } else { 'pwsh' })
    if (-not (Test-Path -LiteralPath $hostExe)) { $hostExe=Join-Path $PSHOME 'pwsh.exe' }
    $previous=$ErrorActionPreference; $ErrorActionPreference='Continue'
    $result=@(& $hostExe -NoLogo -NoProfile -File (Join-Path $setupDir 'setup.ps1') 2>&1)
    $code=$LASTEXITCODE; $ErrorActionPreference=$previous
    Assert ($code -eq 1) 'Setup failure exit code not preserved'
    $log=Get-Content -LiteralPath (Join-Path $setupDir '安装状态.txt') -Raw
    Assert ($log -match 'TEST dependency failure') 'Dependency error not logged'
    Assert (($result -join '') -notmatch 'being used by another process|Add-Content.*IOException') 'Log-lock regression'
    Write-Output 'PASS official checksum formats, URL allowlist, bad-hash stop, portable installation with non-executable fixture, dependency failure log and exit code. Windows UI not tested.'
} finally { $env:Path=$oldPath; $env:OS=$oldOs; Remove-Item -LiteralPath $root -Recurse -Force }
