param([switch]$Scheduled,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$work=Join-Path $PSScriptRoot 'work'
New-Item -ItemType Directory -Path $work -Force | Out-Null
$log=Join-Path $work '运行状态.txt'
function Note([string]$Message) { $line=(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')+' '+$Message; Write-Host $line; Add-Content -LiteralPath $log -Value $line -Encoding UTF8 }
function Invoke-Worker([string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $lines = @(& $script:NodeExe @Arguments 2>&1)
        $code = $LASTEXITCODE
        return [PSCustomObject]@{Code=$code;Text=($lines -join [Environment]::NewLine)}
    } finally { $ErrorActionPreference=$previous }
}
$mutex=[Threading.Mutex]::new($false,'Local\ZhihengDzh600809')
$held=$false
try {
    $held=$mutex.WaitOne(0)
    if (-not $held) { throw '已有任务运行，本次停止，避免同时操作大智慧。' }
    if ((Get-TimeZone).Id -ne 'China Standard Time') { throw '本机时区需为中国标准时间；工具不会修改系统时区。' }
    if ($Scheduled -and (Get-Date).DayOfWeek -in @([DayOfWeek]::Saturday,[DayOfWeek]::Sunday)) { Note '周末跳过。'; exit 0 }
    . (Join-Path $PSScriptRoot 'runtime.ps1')
    Enable-DzhRuntime
    . (Join-Path $PSScriptRoot 'export-ui.ps1')
    $script:NodeExe=(Get-Command node -ErrorAction Stop).Source
    $worker=Join-Path $PSScriptRoot 'worker.mjs'
    $data='D:\DZH_Export\自动更新'
    New-Item -ItemType Directory -Path $data -Force | Out-Null
    $day=Join-Path $data 'auto_day.dad'; $minute=Join-Path $data 'auto_5min.dad'
    $deadline=(Get-Date).Date.AddHours(16).AddMinutes(30)
    do {
        Note '自动生成日线和5分钟DAD（本次600809单股验证）。'
        Export-Dzh '日线' $day
        Export-Dzh '5分钟线' $minute
        $check=Invoke-Worker @($worker,'check',$day,$minute)
        $ready=$check.Code -eq 0
        Note $check.Text
        if ($ready) { break }
        if (-not $Scheduled -or (Get-Date) -ge $deadline) { throw '数据未就绪，未分析上传。旧辅助结果保留，云端不受影响；详见上方检查原因。' }
        Note '5分钟后自动重试；当前日线规则在16:00后才确认当日日线。'
        Start-Sleep -Seconds 300
    } while ($true)
    if ($CheckOnly) { Note '控件和当天数据验证通过；本次未登录或发布。'; exit 0 }
    $packet=Join-Path $work 'local-signals.json'
    $analysis=Invoke-Worker @($worker,'analyze',$day,$minute,$packet)
    if ($analysis.Code -ne 0) { throw $analysis.Text }
    Note $analysis.Text
    Note '正在通过本机GitHub授权提交辅助结果到独立分支；不改main，不上传DAD原件。'
    $published=Invoke-Worker @($worker,'publish',$packet)
    Note $published.Text
    if ($published.Code -ne 0) { throw '发布尚未确认成功，详见运行记录；不能把提交完成当作辅助文件公开可读。' }
    Note '本次单股辅助更新完成；云端股票池未改动。'
} catch {
    Note ('已停止：'+$_.Exception.Message)
    Note '没有将旧数据标为当天成功。请检查work\运行状态.txt；若控件不兼容，可发送work\界面连接报告.txt。'
    exit 1
} finally { if ($held) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
