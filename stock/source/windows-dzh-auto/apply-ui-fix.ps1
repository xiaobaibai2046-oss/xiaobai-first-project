# Patch only the user's selected auxiliary-client installation; no Dazhihui files.
$ErrorActionPreference='Stop'
$log=Join-Path $PSScriptRoot '修复结果.txt'
function Note([string]$Message) { Write-Host $Message; Add-Content -LiteralPath $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss')+' '+$Message) -Encoding UTF8 }
try {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog=New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title='选择之前运行的“01安装与首次连接.cmd”（不选择大智慧程序）'
    $dialog.Filter='首次连接程序|01安装与首次连接.cmd'
    $dialog.CheckFileExists=$true
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Note '已取消，没有修改任何文件。'; exit 0 }
    if ([IO.Path]::GetFileName($dialog.FileName) -cne '01安装与首次连接.cmd') { throw '请选择原来的01安装与首次连接.cmd。' }
    $base=Split-Path $dialog.FileName
    $candidates=@()
    foreach ($path in @((Join-Path $base 'source\windows-dzh-auto'),$base)) {
        if ((Test-Path -LiteralPath (Join-Path $path 'setup.ps1')) -and (Test-Path -LiteralPath (Join-Path $path 'run.ps1')) -and (Test-Path -LiteralPath (Join-Path $path 'runtime.ps1')) -and (Test-Path -LiteralPath (Join-Path $path 'worker.mjs'))) { $candidates+=$path }
    }
    if ($candidates.Count -ne 1) { throw '未能唯一定位原来的辅助工具目录，停止，不搜索其他文件夹。' }
    $target=$candidates[0]
    $worker=Get-Content -LiteralPath (Join-Path $target 'worker.mjs') -Raw -Encoding UTF8
    if (-not $worker.Contains("branch='dzh-aux-data'")) { throw '所选工具不是独立辅助版，停止。请保留云端主路径。' }
    $names=@('export-ui.ps1','selection-policy.ps1','native-list.ps1','native-list.cs','setup.ps1')
    $manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'payload-sha256.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($name in $names) {
        $payload=Join-Path (Join-Path $PSScriptRoot 'payload') $name
        $hash=(Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant()
        if (-not $manifest.$name -or $hash -cne $manifest.$name) { throw ('修复包校验失败：'+$name+'。尚未修改原工具。') }
    }
    $backup=Join-Path $target ('r4备份_'+[Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup | Out-Null
    foreach ($name in $names) {
        $existing=Join-Path $target $name
        if (Test-Path -LiteralPath $existing) { Copy-Item -LiteralPath $existing -Destination (Join-Path $backup $name) }
    }
    try {
        foreach ($name in $names) { Copy-Item -LiteralPath (Join-Path (Join-Path $PSScriptRoot 'payload') $name) -Destination (Join-Path $target $name) -Force }
    } catch {
        foreach ($name in $names) { $saved=Join-Path $backup $name; if (Test-Path -LiteralPath $saved) { Copy-Item -LiteralPath $saved -Destination (Join-Path $target $name) -Force } }
        throw '修复写入失败，已尝试恢复原文件。未改动运行环境、大智慧或云端。'
    }
    Note ('列表识别修复已应用；旧文件备份在：'+$backup)
    Note '补丁阶段保留Node、行情、授权和任务；云端路径未修改。'
    Note '现在自动启动原辅助工具进行一次连接验证。'
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $target 'setup.ps1')
    if ($LASTEXITCODE -ne 0) { Note '修复已应用，但连接仍未通过；请发送原工具work里的界面连接报告和运行状态，不用重新导出行情。'; exit 1 }
    Note '本次辅助连接流程完成。'
} catch { Note ('已停止：'+$_.Exception.Message); exit 1 }
