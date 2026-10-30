$ErrorActionPreference='Stop'
$log=Join-Path $PSScriptRoot '安装状态.txt'
Start-Transcript -Path $log -Force | Out-Null
try {
    if ($env:OS -ne 'Windows_NT') { throw '此工具需要Windows桌面环境。' }
    Write-Host '本次安装会检查或安装Node.js LTS、GitHub CLI；不修改大智慧安装文件。'
    foreach ($component in @(@{command='node';id='OpenJS.NodeJS.LTS'},@{command='gh';id='GitHub.cli'})) {
        if (-not (Get-Command $component.command -ErrorAction SilentlyContinue)) {
            if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw ('缺少'+$component.command+'且没有winget。请从nodejs.org和cli.github.com安装，再运行本安装程序。') }
            & winget install --id $component.id --exact --source winget
            if ($LASTEXITCODE -ne 0) { throw ('未完成安装：'+$component.command) }
            $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
        }
    }
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) { throw 'Node.js至少需要20；本工具主要在24验证。' }
    Write-Host '先检查大智慧控件和当天数据；失败则不会请求GitHub授权，也不创建定时任务。'
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run.ps1') -CheckOnly
    if ($LASTEXITCODE -ne 0) { throw '本机连接检查未通过。请发送work里的运行状态和界面连接报告，无需逐条导出或反复截图。' }
    # Do not record authentication output, device codes or credential prompts.
    Stop-Transcript | Out-Null
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
    Start-Transcript -Path $log -Append | Out-Null
    if ((Get-TimeZone).Id -ne 'China Standard Time') { throw '需要中国标准时间，未创建任务。' }
    $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoLogo -NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'run.ps1')+'" -Scheduled') -WorkingDirectory $PSScriptRoot
    $trigger=New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At '15:30'
    $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName '知衡-大智慧收盘更新-600809' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description '15:30开始检查，数据完整后自动生成、分析和发布；当前仅600809验证。需保持登录、开机、大智慧数据生成窗口可用。' -Force | Out-Null
    Write-Host '定时任务已创建。现在执行首轮完整更新；网站更新是否成功请以运行状态为准。'
    Stop-Transcript | Out-Null
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run.ps1')
    if ($LASTEXITCODE -ne 0) { throw '首轮更新未成功。定时任务已创建，可在任务计划程序停用或运行卸载脚本。' }
} catch { $message='安装未完全完成：'+$_.Exception.Message; Write-Host $message; Add-Content -LiteralPath $log -Value $message -Encoding UTF8; exit 1 }
finally { try { Stop-Transcript | Out-Null } catch {} }
