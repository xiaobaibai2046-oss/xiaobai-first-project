$ErrorActionPreference='Stop'
$log=Join-Path $PSScriptRoot '安装状态.txt'
# Explicit stage logging only; no transcript holds the file or records login prompts.
function SetupNote([string]$Message) {
    $line=(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')+' '+$Message
    Write-Host $line
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}
try {
    if ($env:OS -ne 'Windows_NT') { throw '此工具需要Windows桌面环境。' }
    . (Join-Path $PSScriptRoot 'runtime.ps1')
    SetupNote '辅助工具r3（列表项勾选兼容）：不使用winget，不重置系统软件源，不改动云端更新路径。'
    Ensure-DzhNode
    SetupNote 'Node运行环境已就绪。先检查大智慧控件和当天数据。'
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run.ps1') -CheckOnly
    if ($LASTEXITCODE -ne 0) { throw '本机连接检查未通过。请发送work里的运行状态和界面连接报告，无需逐条导出或反复截图。' }
    SetupNote '本机连接检查通过。准备GitHub CLI；登录输出不会写入安装日志。'
    Ensure-DzhGh
    $previousAction=$ErrorActionPreference; $ErrorActionPreference='Continue'
    & gh auth status --hostname github.com 2>$null
    $authCode=$LASTEXITCODE; $ErrorActionPreference=$previousAction
    if ($authCode -ne 0) {
        Write-Host '请按GitHub CLI提示在浏览器授权自己的账号；不要把密码或令牌发到聊天。'
        & gh auth login --hostname github.com --git-protocol https --web
        if ($LASTEXITCODE -ne 0) { throw 'GitHub登录授权未完成。' }
    }
    $canPush=& gh api repos/xiaobaibai2046-oss/xiaobai-first-project --jq '.permissions.push'
    if ($LASTEXITCODE -ne 0 -or -not $canPush -or $canPush.Trim() -ne 'true') { throw '当前GitHub账号没有目标仓库的写入权限。' }
    SetupNote 'GitHub权限检查通过。仅用于独立辅助分支，不写main或云端信号。'
    if ((Get-TimeZone).Id -ne 'China Standard Time') { throw '需要中国标准时间，未创建任务。' }
    $legacy=Get-ScheduledTask -TaskName '知衡-大智慧收盘更新-600809' -ErrorAction SilentlyContinue
    if ($legacy) { Disable-ScheduledTask -TaskName '知衡-大智慧收盘更新-600809' | Out-Null; SetupNote '已停用本工具旧版主池合并任务。' }
    $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoLogo -NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'run.ps1')+'" -Scheduled') -WorkingDirectory $PSScriptRoot
    $trigger=New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At '15:30'
    $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName '知衡-大智慧辅助更新-600809' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description '15:30检查数据，自动生成分析后仅发布独立大智慧辅助结果，不改动云端主路径。当前仅600809验证。' -Force | Out-Null
    SetupNote '辅助定时任务已创建。现在执行首轮辅助更新，云端主路径不变。'
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run.ps1')
    if ($LASTEXITCODE -ne 0) { throw '首轮辅助更新未成功。辅助任务已创建，可停用或运行卸载脚本；云端照常更新。' }
    SetupNote '首次辅助更新完成。'
} catch {
    $message='辅助安装未完全完成：'+$_.Exception.Message
    try { SetupNote $message } catch { Write-Host $message; Write-Host '无法写入安装日志，请保留本窗口错误提示。' }
    exit 1
}
