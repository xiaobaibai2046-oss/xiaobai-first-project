# Only accessibility patterns on the verified Dazhihui data-generation dialog.
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
. (Join-Path $PSScriptRoot 'selection-policy.ps1')
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
function Get-DzhCheckRecord($Element) {
    $toggleState=$null; $legacyState=$null
    try {
        $p=$null
        if ($Element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$p)) { $toggleState=[string]$p.Current.ToggleState }
    } catch {}
    try {
        $p=$null
        if ($Element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern,[ref]$p)) { $legacyState=[uint32]$p.Current.State }
    } catch {}
    return [PSCustomObject]@{Name=(UiName $Element);Enabled=$Element.Current.IsEnabled;ToggleState=$toggleState;LegacyState=$legacyState}
}
function Save-DzhUiReport([object[]]$Items,[string]$Path) {
    $lines=@('辅助工具r4：只读控件属性，用于检查列表项勾选；不记录账户凭据。')
    foreach ($e in $Items) {
        try {
            $r=Get-DzhCheckRecord $e
            $legacy=if ($null -ne $r.LegacyState) { '0x'+('{0:X8}' -f $r.LegacyState) } else { 'unavailable' }
            $lines+=((UiName $e)+' ['+$e.Current.ControlType.ProgrammaticName+'] Class='+$e.Current.ClassName+' Id='+$e.Current.AutomationId+' Handle='+$e.Current.NativeWindowHandle+' PID='+$e.Current.ProcessId+' Enabled='+$r.Enabled+' Toggle='+$r.ToggleState+' LegacyState='+$legacy)
        } catch { $lines+='[控件读取失败：'+$_.Exception.Message+']' }
    }
    $lines | Set-Content -LiteralPath $Path -Encoding UTF8
}
function Export-Dzh([string]$Period,[string]$Path) {
    $dialog = Get-DzhDialog
    $items = @(Get-DzhElements $dialog)
    Save-DzhUiReport $items (Join-Path $PSScriptRoot 'work\界面连接报告.txt')
    $tabs = @($items | Where-Object { (UiName $_) -eq '生成数据' -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::TabItem })
    if ($tabs.Count -ne 1) { throw '无法可靠识别“生成数据”标签，停止。可发送work里的界面连接报告，不需再导出行情。' }
    Require-Selection $tabs[0]
    # The actual user's report shows List1/ListItem, not CheckBox controls.
    $candidates=@()
    $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::ListItem)
    foreach ($list in @($items | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::List })) {
        $rows=@(); foreach ($entry in $list.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)) { $rows+=$entry }
        if (@($rows | Where-Object { (UiName $_) -match '^600809(?!\d)' }).Count -eq 1) { $candidates += [PSCustomObject]@{List=$list;Rows=$rows} }
    }
    if ($candidates.Count -ne 1) { throw '未唯一识别包含600809的市场列表，停止。' }
    $states=@($candidates[0].Rows | ForEach-Object { Get-DzhCheckRecord $_ })
    try { Assert-DzhStockChecks $states }
    catch {
        # Only an unreadable interface can trigger the read-only native fallback.
        # Known UIA states must agree with the native result; ambiguity still stops.
        if (@($states | Where-Object { -not $_.ToggleState -and $null -eq $_.LegacyState }).Count -eq 0) { throw }
        foreach ($state in $states) {
            if ($state.ToggleState -and $state.ToggleState -notin @('On','Off')) { throw 'UIA勾选状态不确定，停止。' }
            if ($null -ne $state.LegacyState -and (([uint32]$state.LegacyState -band 0x20) -ne 0)) { throw '可访问勾选状态不确定，停止。' }
        }
        . (Join-Path $PSScriptRoot 'native-list.ps1')
        $nativeStates=@(Read-DzhNativeChecks $candidates[0].List $candidates[0].Rows)
        if ($nativeStates.Count -ne $states.Count) { throw '原生列表状态数量不一致。' }
        for ($i=0;$i -lt $states.Count;$i++) {
            if ($states[$i].ToggleState -and $states[$i].ToggleState -cne $nativeStates[$i].ToggleState) { throw 'UIA与原生列表状态矛盾，停止。' }
        }
        $nativeStates | ForEach-Object { 'NativeCheck '+$_.Name+' Image='+$_.NativeImage+' Checked='+$_.ToggleState } | Add-Content -LiteralPath (Join-Path $PSScriptRoot 'work\界面连接报告.txt') -Encoding UTF8
        Assert-DzhStockChecks $nativeStates
    }
    Write-Host '已核对列表项勾选状态：只选600809，其他市场／个股均未勾选。'
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
