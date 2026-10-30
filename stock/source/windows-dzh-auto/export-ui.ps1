# Only accessibility patterns on the verified Dazhihui data-generation dialog.
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function UiName($Element) { return $Element.Current.Name.Replace('&','').Trim() }
function Get-DzhDialog {
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
    foreach ($window in $windows) {
        try {
            $p = Get-Process -Id $window.Current.ProcessId
            if (-not $p.Path -or -not $p.Path.StartsWith('C:\dzh365(64)\',[StringComparison]::OrdinalIgnoreCase)) { continue }
            if ((UiName $window) -eq '数据管理中心') { return $window }
            $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,'数据管理中心')
            $dialog = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
            if ($null -ne $dialog -and -not $dialog.Current.IsOffscreen) { return $dialog }
        } catch { continue }
    }
    throw '未找到数据管理中心。请让大智慧登录，并保持“生成数据”窗口打开；工具不盲点菜单。'
}
function Get-DzhElements($Dialog) {
    $all = $Dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
    $items = @(); foreach ($e in $all) { $items += $e }; return $items
}
function Require-Selection($Element) {
    $p = $null
    if (-not $Element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$p)) { throw ('控件不提供可验证的选择状态：'+(UiName $Element)) }
    if (-not $p.Current.IsSelected) { throw ('请先选中：'+(UiName $Element)) }
}
function Export-Dzh([string]$Period,[string]$Path) {
    $dialog = Get-DzhDialog
    $items = @(Get-DzhElements $dialog)
    $items | ForEach-Object { (UiName $_) + ' [' + $_.Current.ControlType.ProgrammaticName + ']' } | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'work\界面连接报告.txt') -Encoding UTF8
    $tabs = @($items | Where-Object { (UiName $_) -eq '生成数据' -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::TabItem })
    if ($tabs.Count -ne 1) { throw '无法可靠识别“生成数据”标签，停止。可发送work里的界面连接报告，不需再导出行情。' }
    Require-Selection $tabs[0]
    $codes = @($items | ForEach-Object { [regex]::Matches((UiName $_),'(?<!\d)\d{6}(?!\d)') } | ForEach-Object { $_.Value } | Select-Object -Unique)
    if ($codes.Count -ne 1 -or $codes[0] -ne '600809') { throw '本次连接验证必须只选择600809；不会把单股当作全池。' }
    $checks = @($items | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::CheckBox })
    if ($checks.Count -eq 0) { throw '无法核实市场复选框，停止，不使用固定坐标。' }
    foreach ($box in $checks) {
        $toggle = $null
        if (-not $box.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$toggle)) { throw '市场复选框不支持可靠状态读取。' }
        if ($toggle.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::Off -and (UiName $box) -notmatch '600809') { throw ('请取消其他市场／个股的勾选：'+(UiName $box)) }
    }
    $radios = @($items | Where-Object { (UiName $_) -eq $Period -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::RadioButton })
    if ($radios.Count -ne 1) { throw ('无法可靠识别周期：'+$Period) }
    $select = $null
    if (-not $radios[0].TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$select)) { throw '周期控件不支持程序选择，停止。' }
    $select.Select(); Require-Selection $radios[0]
    $paths = @()
    foreach ($edit in @($items | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit })) {
        $value = $null
        if ($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$value) -and $value.Current.Value -match '\.dad$') { $paths += $value }
    }
    if ($paths.Count -ne 1 -or $paths[0].Current.IsReadOnly) { throw '无法唯一识别可写的DAD输出路径，停止。' }
    $buttons = @($items | Where-Object { (UiName $_) -match '^执行生成(?:\.{3}|…)?$' -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button })
    if ($buttons.Count -ne 1 -or -not $buttons[0].Current.IsEnabled) { throw '未识别可用的执行生成按钮，停止。' }
    $invoke = $null
    if (-not $buttons[0].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$invoke)) { throw '生成按钮不支持程序调用，停止。' }
    $paths[0].SetValue($Path)
    if ($paths[0].Current.Value -ne $Path) { throw '路径写入未生效。' }
    # Only our dedicated generated files; never overwrite the user's test files.
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path }
    $invoke.Invoke()
    $previousLength = -1
    for ($i=0; $i -lt 120; $i++) {
        Start-Sleep -Milliseconds 500
        if (-not (Test-Path -LiteralPath $Path)) { continue }
        try {
            $length = (Get-Item -LiteralPath $Path).Length
            if ($length -gt 8388608) { throw '单股生成文件超过8MB，本次格式范围不支持。' }
            if ($length -ge 112 -and $length -eq $previousLength -and $buttons[0].Current.IsEnabled) {
                $bytes = [IO.File]::ReadAllBytes($Path)
                if ([BitConverter]::ToUInt32($bytes,$bytes.Length-32) -eq [UInt32]::MaxValue) { return }
            }
            $previousLength = $length
        } catch { if ($_.Exception.Message -match '超过8MB') { throw }; continue }
    }
    throw '60秒内未生成完整文件。可能有确认框或生成失败；工具不会自动点击未知弹窗。'
}
