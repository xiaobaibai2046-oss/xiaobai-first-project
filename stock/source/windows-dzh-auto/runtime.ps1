# Portable, process-local runtimes. No winget, registry edits, source resets or elevation.
function Enable-DzhRuntime {
    foreach ($directory in @((Join-Path $PSScriptRoot 'runtime\node'),(Join-Path $PSScriptRoot 'runtime\gh'))) {
        if ((Test-Path -LiteralPath $directory -PathType Container) -and ([string]$env:Path).Split(';') -notcontains $directory) { $env:Path=$directory+';'+$env:Path }
    }
}
function Get-DzhChecksum([string]$Manifest,[string]$Name) {
    $matchesFound=@()
    foreach ($line in ($Manifest -split '\r?\n')) {
        if ($line -match '^\s*([a-fA-F0-9]{64})\s+\*?(.+?)\s*$') {
            if ($Matches[2] -ceq $Name) { $matchesFound += $Matches[1].ToLowerInvariant() }
        }
    }
    if ($matchesFound.Count -ne 1) { throw ('官方校验清单中未唯一找到文件：'+$Name) }
    return $matchesFound[0]
}
function Get-DzhWeb([string]$Uri) {
    if (([uri]$Uri).Scheme -ne 'https' -or ([uri]$Uri).Host -notin @('nodejs.org','github.com')) { throw '下载地址不在官方HTTPS白名单，停止。' }
    # Keep normal certificate validation; add TLS1.2 support on older Windows .NET.
    [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    return Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 90 -MaximumRedirection 5
}
function Convert-DzhWebText($Response) {
    if ($Response.Content -is [byte[]]) { return [Text.Encoding]::UTF8.GetString($Response.Content).TrimStart([char]0xFEFF) }
    return ([string]$Response.Content).TrimStart([char]0xFEFF)
}
function Save-DzhDownload([string]$Uri,[string]$Path) {
    if (([uri]$Uri).Scheme -ne 'https' -or ([uri]$Uri).Host -notin @('nodejs.org','github.com')) { throw '下载地址不在官方HTTPS白名单，停止。' }
    [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $previous=$ProgressPreference; $ProgressPreference='SilentlyContinue'
    try { Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Path -TimeoutSec 180 -MaximumRedirection 5 }
    finally { $ProgressPreference=$previous }
}
function Install-DzhPortable([string]$Kind,[string]$AssetUrl,[string]$HashUrl,[string]$AssetName,[string]$ExeName) {
    if ($Kind -notin @('node','gh') -or $ExeName -notin @('node.exe','gh.exe')) { throw '不支持的运行组件。' }
    $root=Join-Path $PSScriptRoot 'runtime'
    $downloads=Join-Path $root 'downloads'
    New-Item -ItemType Directory -Path $downloads -Force | Out-Null
    $manifest=Convert-DzhWebText (Get-DzhWeb $HashUrl)
    $expected=Get-DzhChecksum $manifest $AssetName
    $archive=Join-Path $downloads $AssetName
    Write-Host ('正在下载官方便携组件：'+$AssetName+'；不使用winget，不写系统安装目录。')
    Save-DzhDownload $AssetUrl $archive
    $actual=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -cne $expected) {
        Remove-Item -LiteralPath $archive
        throw '下载SHA256与官方清单不一致，已停止，未解压或运行下载文件。'
    }
    $zip=$null; $inputStream=$null; $outputStream=$null; $temp=$null
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip=[IO.Compression.ZipFile]::OpenRead($archive)
        $executables=@($zip.Entries | Where-Object { [IO.Path]::GetFileName($_.FullName) -ceq $ExeName })
        if ($executables.Count -ne 1 -or $executables[0].Length -le 0 -or $executables[0].Length -gt 209715200) { throw '官方压缩包结构或组件大小不符合预期，停止。' }
        $destination=Join-Path $root $Kind
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        $temp=Join-Path $destination ($ExeName+'.partial-'+[Guid]::NewGuid().ToString('N'))
        # Extract only the standalone executable: avoid npm's deep Windows paths.
        $inputStream=$executables[0].Open()
        $outputStream=[IO.File]::Open($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        $inputStream.CopyTo($outputStream)
        $inputStream.Dispose(); $inputStream=$null
        $outputStream.Dispose(); $outputStream=$null
        if ((Get-Item -LiteralPath $temp).Length -ne $executables[0].Length) { throw '便携组件写入不完整，停止。' }
        Move-Item -LiteralPath $temp -Destination (Join-Path $destination $ExeName) -Force
        Set-Content -LiteralPath (Join-Path $destination '来源与校验.txt') -Value ($AssetUrl+[Environment]::NewLine+'SHA256 '+$actual) -Encoding UTF8
        Write-Host ('已验证并保存便携组件：'+$ExeName)
    } finally {
        if ($null -ne $inputStream) { $inputStream.Dispose() }
        if ($null -ne $outputStream) { $outputStream.Dispose() }
        if ($null -ne $zip) { $zip.Dispose() }
        if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp }
    }
    Remove-Item -LiteralPath $archive
    Enable-DzhRuntime
}
function Test-DzhNode {
    $command=Get-Command node -ErrorAction SilentlyContinue
    if (-not $command) { return $false }
    $previous=$ErrorActionPreference; $ErrorActionPreference='Continue'
    try { $version=& $command.Source --version 2>$null; return ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20) }
    catch { return $false } finally { $ErrorActionPreference=$previous }
}
function Ensure-DzhNode {
    Enable-DzhRuntime
    if (Test-DzhNode) { return }
    if (-not [Environment]::Is64BitOperatingSystem) { throw '便携运行组件目前只支持64位Windows。' }
    $releases=(Convert-DzhWebText (Get-DzhWeb 'https://nodejs.org/dist/index.json')) | ConvertFrom-Json
    $release=@($releases | Where-Object { $_.version -match '^v24\.\d+\.\d+$' -and $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1)
    if ($release.Count -ne 1) { throw '无法从官方清单找到Node24 LTS的Windows x64版本。' }
    $version=$release[0].version; $name='node-'+$version+'-win-x64.zip'; $base='https://nodejs.org/dist/'+$version+'/'
    Install-DzhPortable 'node' ($base+$name) ($base+'SHASUMS256.txt') $name 'node.exe'
    if (-not (Test-DzhNode)) { throw '便携Node无法运行；请保留具体系统错误，不修改系统软件源。' }
}
function Ensure-DzhGh {
    Enable-DzhRuntime
    $command=Get-Command gh -ErrorAction SilentlyContinue
    if ($command) { return }
    $response=Get-DzhWeb 'https://github.com/cli/cli/releases/latest'
    $uri=$response.BaseResponse.ResponseUri
    if (-not $uri -and $response.BaseResponse.RequestMessage) { $uri=$response.BaseResponse.RequestMessage.RequestUri }
    if (-not $uri -or $uri.Host -ne 'github.com' -or $uri.AbsolutePath -notmatch '^/cli/cli/releases/tag/v(\d+\.\d+\.\d+)$') { throw '无法确认GitHub CLI官方版本地址。' }
    $version=$Matches[1]; $name='gh_'+$version+'_windows_amd64.zip'; $base='https://github.com/cli/cli/releases/download/v'+$version+'/'
    Install-DzhPortable 'gh' ($base+$name) ($base+'gh_'+$version+'_checksums.txt') $name 'gh.exe'
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI便携组件未能启用。' }
}
