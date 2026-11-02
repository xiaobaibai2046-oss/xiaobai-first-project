# Pure validation of states read through UIA Toggle or MSAA Checked flags.
# MSAA Selected (0x2) is NOT Checked (0x10); never infer checks from highlighting.
function Assert-DzhStockChecks([object[]]$States) {
    if (-not $States -or $States.Count -eq 0) { throw '列表没有可核验的项目，停止。' }
    $target=@($States | Where-Object { $_.Name -match '^600809(?!\d)' })
    if ($target.Count -ne 1) { throw '必须唯一识别600809列表项，停止。' }
    if ($target[0].Enabled -ne $true) { throw '600809列表项不可用，停止。' }
    $legacyAnchor=($null -ne $target[0].LegacyState -and (([uint32]$target[0].LegacyState -band 0x10) -ne 0) -and (([uint32]$target[0].LegacyState -band 0x20) -eq 0))
    foreach ($item in $States) {
        $checked=$false
        if ($item.ToggleState -in @('On','Off')) {
            $checked=$item.ToggleState -eq 'On'
        } elseif ($item.ToggleState) {
            throw ('列表项处于混合或未知勾选状态：'+$item.Name)
        } elseif ($null -ne $item.LegacyState) {
            if (-not $legacyAnchor) { throw '列表未暴露可验证的Checked标记；高亮选中不能视为勾选，停止。' }
            $state=[uint32]$item.LegacyState
            if (($state -band 0x20) -ne 0) { throw ('列表项勾选状态不确定：'+$item.Name) }
            $checked=($state -band 0x10) -ne 0
        } else { throw ('无法读取列表项勾选状态：'+$item.Name) }
        $isTarget=$item.Name -match '^600809(?!\d)'
        if ($isTarget -and -not $checked) { throw '600809尚未勾选，停止。' }
        if (-not $isTarget -and $checked) { throw ('其他市场或股票仍勾选：'+$item.Name) }
    }
}
