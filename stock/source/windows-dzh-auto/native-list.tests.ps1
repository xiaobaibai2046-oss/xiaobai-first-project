# Tests pure validation only; no Windows handles/messages/COM calls are made here.
$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-list.cs') -Raw -Encoding UTF8
if ($env:OS -eq 'Windows_NT') {
    Add-Type -AssemblyName Accessibility
    Add-Type -TypeDefinition $source -ReferencedAssemblies @([Accessibility.IAccessible].Assembly.Location)
} else {
    # Minimal compile-time stand-in for the Windows-built-in reference assembly.
    $stub='namespace Accessibility { public interface IAccessible { int accChildCount { get; } string get_accName(object child); object get_accState(object child); } }'
    Add-Type -TypeDefinition ($source+[Environment]::NewLine+$stub)
}
function Assert($Value,[string]$Message) { if (-not $Value) { throw $Message } }
$expected=[string[]]@('上海证券交易所',"600809`t山西汾酒")
$actual=[string[]]@('上海证券交易所','600809 山西汾酒')
$result=[Zhiheng.DzhNativeList]::Validate('SysListView32',123,123,4,2,2,$expected,$actual,[uint32[]]@(0x1002,0x2002))
Assert ($result.Length -eq 2 -and $result[0].StateImage -eq 1 -and $result[1].StateImage -eq 2) 'Image checks confused with selected/highlight flags'
$legacy=[Zhiheng.DzhNativeList]::ValidateWithAccessibility('SysListView32',123,123,0,2,2,$expected,$actual,[uint32[]]@(0x1000,0x2000),[uint32[]]@(0,0x10))
Assert ($legacy[1].StateImage -eq 2) 'Genuine MSAA Checked anchor failed'
foreach($legacyStates in @([uint32[]]@(0,2),[uint32[]]@(0x10,0x10),[uint32[]]@(0x20,0x10))) {
    $failed=$false
    try { [Zhiheng.DzhNativeList]::ValidateWithAccessibility('SysListView32',123,123,0,2,2,$expected,$actual,[uint32[]]@(0x1000,0x2000),$legacyStates) | Out-Null } catch { $failed=$true }
    Assert $failed 'Unanchored or contradictory MSAA flags passed'
}
$cases=@(
 @{Class='ListBox';Pid=123;Style=4;Count=2;Accessible=2;Names=$actual;States=[uint32[]]@(0x1000,0x2000)},
 @{Class='SysListView32';Pid=999;Style=4;Count=2;Accessible=2;Names=$actual;States=[uint32[]]@(0x1000,0x2000)},
 @{Class='SysListView32';Pid=123;Style=0;Count=2;Accessible=2;Names=$actual;States=[uint32[]]@(0x1000,0x2000)},
 @{Class='SysListView32';Pid=123;Style=4;Count=3;Accessible=2;Names=$actual;States=[uint32[]]@(0x1000,0x2000)},
 @{Class='SysListView32';Pid=123;Style=4;Count=2;Accessible=1;Names=$actual;States=[uint32[]]@(0x1000,0x2000)},
 @{Class='SysListView32';Pid=123;Style=4;Count=2;Accessible=2;Names=[string[]]@('600809 山西汾酒','上海证券交易所');States=[uint32[]]@(0x1000,0x2000)},
 @{Class='SysListView32';Pid=123;Style=4;Count=2;Accessible=2;Names=$actual;States=[uint32[]]@(0x1000,2)},
 @{Class='SysListView32';Pid=123;Style=4;Count=2;Accessible=2;Names=$actual;States=[uint32[]]@(0x1000,0x3000)}
)
foreach ($case in $cases) {
    $failed=$false
    try { [Zhiheng.DzhNativeList]::Validate($case.Class,$case.Pid,123,$case.Style,$case.Count,$case.Accessible,$expected,$case.Names,$case.States) | Out-Null } catch { $failed=$true }
    Assert $failed 'An invalid native snapshot passed validation'
}
Write-Output 'PASS native helper compilation and snapshot validation: class, PID, checkbox style, counts, names/order, image masks and highlighting. Real Windows messages/COM still need device validation.'
