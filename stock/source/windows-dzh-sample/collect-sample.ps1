# One-time, fixed allowlist of market-cache snapshots. No accounts, UI or network.
$ErrorActionPreference = 'Stop'
$root = 'C:\dzh365(64)\data\SH'
$run = Join-Path $PSScriptRoot ('采样结果_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '_' + [Guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $run | Out-Null
$manifest = @()
$targets = @('DAY_2.DAT','DAY_2.DAT.dat','MIN_2.DAT','MIN_2.DAT.dat')
try {
    foreach ($directory in @('C:\dzh365(64)','C:\dzh365(64)\data',$root)) {
        $item = Get-Item -LiteralPath $directory
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw '目录不存在或是链接，停止读取。' }
    }
    foreach ($name in $targets) {
        $path = Join-Path $root $name
        $saved = $false
        $errorText = ''
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            $source = $null; $output = $null
            $temp = Join-Path $run ($name + '.snapshot-tmp')
            try {
                $before = Get-Item -LiteralPath $path
                if ($before.PSIsContainer -or ($before.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw '不是普通文件，停止读取。' }
                if ($before.Length -gt 16777216) { throw '单文件超过16MB限制，停止采样。' }
                $source = [IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
                $output = [IO.File]::Open($temp,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
                $remaining = $before.Length
                $buffer = New-Object byte[] 65536
                while ($remaining -gt 0) {
                    $count = $source.Read($buffer,0,[int][Math]::Min($remaining,$buffer.Length))
                    if ($count -eq 0) { throw '读取期间文件缩短。' }
                    $output.Write($buffer,0,$count)
                    $remaining -= $count
                }
                $source.Dispose(); $source = $null
                $output.Dispose(); $output = $null
                $after = Get-Item -LiteralPath $path
                if ($before.Length -ne $after.Length -or $before.LastWriteTimeUtc -ne $after.LastWriteTimeUtc) { throw '读取期间检测到写入，稍后重试。' }
                $dest = Join-Path $run $name
                Move-Item -LiteralPath $temp -Destination $dest
                $manifest += [PSCustomObject]@{ File=$name; Status='copied'; Bytes=$after.Length; ModifiedUtc=$after.LastWriteTimeUtc.ToString('o'); SHA256=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash; Error='' }
                Write-Host ('已复制行情样本：' + $name + '，' + $after.Length + '字节')
                $saved = $true
                break
            } catch { $errorText = $_.Exception.Message; Start-Sleep -Milliseconds 500 }
            finally {
                if ($null -ne $source) { $source.Dispose() }
                if ($null -ne $output) { $output.Dispose() }
                if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
            }
        }
        if (-not $saved) {
            $manifest += [PSCustomObject]@{File=$name;Status='failed';Bytes=0;ModifiedUtc='';SHA256='';Error=$errorText}
            Write-Host ('未复制：' + $name + '；' + $errorText)
        }
    }
} catch { $manifest += [PSCustomObject]@{File='';Status='failed';Bytes=0;ModifiedUtc='';SHA256='';Error=$_.Exception.Message}; Write-Host $_.Exception.Message }
$manifest | Export-Csv -LiteralPath (Join-Path $run '采样清单.csv') -NoTypeInformation -Encoding UTF8
Set-Content -LiteralPath (Join-Path $run '说明.txt') -Value ('固定读取沪市4个市场缓存文件的副本；不读取账户目录或密码，不操作交易，不联网上传。可能包含多只沪市证券；可检查后再分享。原软件仍运行时，各文件副本不保证跨文件原子一致，需要后续格式校验。采样时间：' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -Encoding UTF8
$zip = Join-Path $PSScriptRoot '大智慧沪市缓存样本.zip'
$files = @($targets | ForEach-Object { Join-Path $run $_ } | Where-Object { Test-Path -LiteralPath $_ })
$files += (Join-Path $run '采样清单.csv'); $files += (Join-Path $run '说明.txt')
Compress-Archive -LiteralPath $files -DestinationPath $zip -Force
Write-Host ('完成。检查内容后，把这个一次性样本包发回聊天：' + $zip)
