$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'selection-policy.ps1')
function Item([string]$Name,$Toggle,$Legacy,[bool]$Enabled=$true) { return [PSCustomObject]@{Name=$Name;ToggleState=$Toggle;LegacyState=$Legacy;Enabled=$Enabled} }
function Reject([object[]]$Items) { $rejected=$false; try { Assert-DzhStockChecks $Items } catch { $rejected=$true }; if (-not $rejected) { throw 'Unsafe selection was accepted' } }
Assert-DzhStockChecks @((Item '上海证券交易所' 'Off' $null),(Item "600809`t山西汾酒" 'On' $null))
Assert-DzhStockChecks @((Item '上海证券交易所' $null 0),(Item '600809 山西汾酒' $null 0x10))
Assert-DzhStockChecks @((Item '上海证券交易所' $null 0x2),(Item '600809 山西汾酒' $null 0x12))
Reject @((Item '上海证券交易所' 'On' $null),(Item '600809 山西汾酒' 'On' $null))
Reject @((Item '上海证券交易所' $null 0x10),(Item '600809 山西汾酒' $null 0x10))
Reject @((Item '上海证券交易所' $null 0),(Item '600809 山西汾酒' $null 0x2))
Reject @((Item '上海证券交易所' 'Off' $null),(Item '600809 山西汾酒' 'Off' $null))
Reject @((Item '上海证券交易所' $null $null),(Item '600809 山西汾酒' 'On' $null))
Reject @((Item '上海证券交易所' $null 0),(Item '600809 山西汾酒' 'On' $null))
Reject @((Item '上海证券交易所' 'Indeterminate' $null),(Item '600809 山西汾酒' 'On' $null))
Reject @((Item '上海证券交易所' $null 0x20),(Item '600809 山西汾酒' $null 0x10))
Reject @((Item '600809 山西汾酒' 'On' $null),(Item '600809 duplicate' 'On' $null))
Reject @((Item '600809 山西汾酒' 'On' $null $false))
Reject @((Item '6008090 invalid' 'On' $null))
Write-Output 'PASS Toggle and Legacy Checked validation; highlighting, mixed states, extra markets, missing states, duplicate target and disabled target rejected. Windows UI still requires live verification.'
