function Read-DzhNativeChecks($List,[object[]]$Rows) {
    if ($List.Current.ClassName -ne 'SysListView32') { throw '当前列表不是已确认的SysListView32，不使用通用坐标或猜测状态。' }
    if (-not ('Zhiheng.DzhNativeList' -as [type])) {
        Add-Type -AssemblyName Accessibility
        $source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-list.cs') -Raw -Encoding UTF8
        Add-Type -TypeDefinition $source -ReferencedAssemblies @([Accessibility.IAccessible].Assembly.Location)
    }
    $names=[string[]]@($Rows | ForEach-Object { UiName $_ })
    $native=[Zhiheng.DzhNativeList]::Read([IntPtr]::new($List.Current.NativeWindowHandle),[uint32]$List.Current.ProcessId,$names)
    $result=@()
    foreach ($item in $native) {
        $result += [PSCustomObject]@{Name=$item.Name;Enabled=$Rows[$item.Index].Current.IsEnabled;ToggleState=$(if ($item.StateImage -eq 2) { 'On' } else { 'Off' });LegacyState=$null;NativeImage=$item.StateImage}
    }
    return $result
}
