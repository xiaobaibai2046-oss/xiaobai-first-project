$ErrorActionPreference='Stop'
Unregister-ScheduledTask -TaskName '知衡-大智慧收盘更新-600809' -Confirm:$false
Write-Host '已移除本工具定时任务，未删除行情、分析文件或GitHub授权。'
