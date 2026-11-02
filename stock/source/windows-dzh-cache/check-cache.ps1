# Read-only inventory of the known Dazhihui market-data directory.
# No file contents, account data, UI automation, uploads, or scheduled tasks.
$ErrorActionPreference = 'Stop'
$script:Install = 'C:\dzh365(64)'
$script:Root = Join-Path $script:Install 'data'
$script:Out = Join-Path $PSScriptRoot '检测结果'
New-Item -ItemType Directory -Path $script:Out -Force | Out-Null
$script:Log = Join-Path $script:Out '检测说明.txt'
$script:Issues = @()
function Note([string]$Message) {
    $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $Message
    Write-Host $line
    Add-Content -LiteralPath $script:Log -Value $line -Encoding UTF8
}
function Snapshot {
    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    $queue.Enqueue($script:Root)
    $rows = New-Object 'System.Collections.Generic.List[object]'
    while ($queue.Count -gt 0) {
        $directory = $queue.Dequeue()
        try { $items = @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop) }
        catch { $script:Issues += ('无法列出目录：' + $directory.Substring($script:Root.Length) + '；' + $_.Exception.Message); continue }
        foreach ($item in $items) {
            # Never traverse junctions, symlinks or other reparse points.
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            if ($item.PSIsContainer) { $queue.Enqueue($item.FullName); continue }
            $rows.Add([PSCustomObject]@{
                RelativePath = $item.FullName.Substring($script:Root.Length).TrimStart([char]'\')
                Extension = $item.Extension
                Bytes = $item.Length
                ModifiedUtc = $item.LastWriteTimeUtc.ToString('o')
            })
            if ($rows.Count -ge 10000) { $script:Issues += '达到10000文件上限；清单不是全目录覆盖。'; return $rows.ToArray() }
        }
    }
    return $rows.ToArray()
}
try {
    Set-Content -LiteralPath $script:Log -Value '大智慧缓存定位：只读元数据检测。此工具不是已接通的行情采集程序。' -Encoding UTF8
    foreach ($name in @('首次文件清单.csv','再次文件清单.csv','发生变化的文件.csv','未发现文件变化.txt','文件类型汇总.csv')) {
        $oldReport = Join-Path $script:Out $name
        if (Test-Path -LiteralPath $oldReport) { Remove-Item -LiteralPath $oldReport }
    }
    Note ('只读取文件名、大小、修改时间，目录：' + $script:Root)
    if (-not (Test-Path -LiteralPath $script:Root -PathType Container)) {
        if (Test-Path -LiteralPath $script:Install -PathType Container) {
            $dirs = @(Get-ChildItem -LiteralPath $script:Install -Directory | Select-Object -ExpandProperty Name)
            Note ('安装目录下的文件夹：' + ($dirs -join '，'))
        }
        throw '未找到data文件夹。未搜索其他磁盘或用户目录，请发回检测说明定位。'
    }
    if (((Get-Item -LiteralPath $script:Root).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'data目录是链接，工具不跟随，停止。' }
    $before = @(Snapshot)
    $before | Export-Csv -LiteralPath (Join-Path $script:Out '首次文件清单.csv') -NoTypeInformation -Encoding UTF8
    Note ('首次列出 ' + $before.Count + ' 个文件。保持大智慧在线接收行情，接下来自动等待2分钟。')
    for ($i = 1; $i -le 8; $i++) { Start-Sleep -Seconds 15; Write-Host ('等待 ' + ($i * 15) + '/120秒…') }
    $after = @(Snapshot)
    $after | Export-Csv -LiteralPath (Join-Path $script:Out '再次文件清单.csv') -NoTypeInformation -Encoding UTF8
    $old = @{}
    foreach ($item in $before) { $old[$item.RelativePath] = $item }
    $changed = @()
    foreach ($item in $after) {
        $previous = $old[$item.RelativePath]
        if ($null -eq $previous -or $previous.Bytes -ne $item.Bytes -or $previous.ModifiedUtc -ne $item.ModifiedUtc) { $changed += $item }
    }
    if ($changed.Count -gt 0) {
        $changed | Export-Csv -LiteralPath (Join-Path $script:Out '发生变化的文件.csv') -NoTypeInformation -Encoding UTF8
    } else { Set-Content -LiteralPath (Join-Path $script:Out '未发现文件变化.txt') -Value '两次检查间没有发现文件大小或修改时间变化。非交易时段、无行情接收或软件未落盘都可能导致此结果，不能直接判定不支持自动采集。' -Encoding UTF8 }
    $after | Group-Object Extension | Select-Object Name, Count | Export-Csv -LiteralPath (Join-Path $script:Out '文件类型汇总.csv') -NoTypeInformation -Encoding UTF8
    Note ('检测结束：' + $after.Count + ' 个文件，其中 ' + $changed.Count + ' 个新增或变化。')
    Note '只凭文件变化不能证明它是5分钟行情。下一步需核对具体格式、股票代码、K线时间和价格。'
    Note '检查过程中未读取任何文件内容，未操作大智慧界面，未上传任何文件。'
    if ($script:Issues.Count -gt 0) { Note ('覆盖限制：' + (($script:Issues | Select-Object -Unique) -join '；')) }
} catch { Note ('已停止：' + $_.Exception.Message) }
finally {
    Note ('结果目录：' + $script:Out)
    $zip = Join-Path $PSScriptRoot '大智慧缓存检测结果.zip'
    try {
        if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
        $reportPaths = @('检测说明.txt','首次文件清单.csv','再次文件清单.csv','发生变化的文件.csv','未发现文件变化.txt','文件类型汇总.csv') | ForEach-Object { Join-Path $script:Out $_ } | Where-Object { Test-Path -LiteralPath $_ }
        Compress-Archive -LiteralPath $reportPaths -DestinationPath $zip -Force
        Write-Host ('请先检查报告内容，再将这个文件发回聊天：' + $zip)
    } catch { Write-Host '结果打包失败，可以直接发送“检测说明.txt”和CSV清单。' }
}
