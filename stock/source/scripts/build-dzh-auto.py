"""Bundle source-only Windows client; no credentials, user data or runtimes."""
from pathlib import Path
import json
import zipfile
root=Path(__file__).resolve().parent.parent
client=root/'windows-dzh-auto'
engine=['strategy-config.js','dzh-dad.js','macd.js','signal-model.js','conclusion.js','indicators.js','research.js','providers.js','pool-model.js']
out=root.parent/'dzh-daily-auto.zip'
prefix='大智慧辅助自动更新/'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr(prefix+'source/package.json',json.dumps({'private':True,'type':'module'}))
    for name in engine:z.write(root/name,prefix+'source/'+name)
    allowed=['worker.mjs','runtime.ps1','selection-policy.ps1','export-ui.ps1','run.ps1','setup.ps1','remove-task.ps1','01安装与首次连接.cmd','02立即更新.cmd','03移除定时任务.cmd','使用说明.txt']
    for name in allowed:
        p=client/name
        if not p.is_file():raise FileNotFoundError(name)
        data=p.read_text(encoding='utf-8-sig')
        if p.suffix=='.ps1':raw=data.encode('utf-8-sig')
        elif p.suffix=='.cmd':raw=data.replace('\r\n','\n').replace('\n','\r\n').encode('utf-8')
        else:raw=data.encode('utf-8')
        z.writestr(prefix+'source/windows-dzh-auto/'+p.name,raw)
        if p.suffix=='.cmd':
            target={'01安装与首次连接.cmd':'setup.ps1','02立即更新.cmd':'run.ps1','03移除定时任务.cmd':'remove-task.ps1'}[p.name]
            wrapper='@echo off\r\nchcp 65001 >nul\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0source\\windows-dzh-auto\\'+target+'"\r\npause\r\n'
            z.writestr(prefix+p.name,wrapper.encode('utf-8'))
        if p.name=='使用说明.txt':z.writestr(prefix+'先读说明.txt',raw)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert all('/work/' not in p and not p.endswith('local-signals.json') for p in z.namelist())
print('Built',out.name,out.stat().st_size,'bytes; source only. Windows UI execution not validated in cloud.')

# A small in-place patch preserves the already-installed portable runtimes.
import hashlib
patch=root.parent/'dzh-ui-fix-r3.zip'
patch_prefix='大智慧列表识别修复r3/'
manifest={}
with zipfile.ZipFile(patch,'w',zipfile.ZIP_DEFLATED) as z:
    for name in ['export-ui.ps1','selection-policy.ps1','setup.ps1']:
        data=(client/name).read_text(encoding='utf-8-sig').encode('utf-8-sig')
        manifest[name]=hashlib.sha256(data).hexdigest()
        z.writestr(patch_prefix+'payload/'+name,data)
    z.writestr(patch_prefix+'payload-sha256.json',json.dumps(manifest,ensure_ascii=False))
    z.writestr(patch_prefix+'apply-ui-fix.ps1',(client/'apply-ui-fix.ps1').read_text(encoding='utf-8-sig').encode('utf-8-sig'))
    wrapper='@echo off\r\nchcp 65001 >nul\r\npowershell.exe -STA -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-ui-fix.ps1"\r\npause\r\n'
    z.writestr(patch_prefix+'应用修复.cmd',wrapper.encode('utf-8'))
    z.writestr(patch_prefix+'先读说明.txt','列表识别修复r3（不重装Node，不移动原工具）\n关闭原来报错的黑窗口，大智慧保持生成数据页。解压本修复包，双击“应用修复.cmd”，在弹窗中选择之前运行的“01安装与首次连接.cmd”。程序会定位原辅助工具，核验独立辅助分支和补丁SHA256，备份并更新3个脚本，再自动运行原工具。\n补丁阶段不修改运行环境、行情、授权或定时任务；不猜原安装路径，不读取账户，不使用坐标。随后原安装流程检查通过后，会继续进行缺少组件安装、GitHub授权和辅助任务配置，云端主路径始终不变。若仍不支持勾选状态，程序停止并生成更详细的控件报告。补丁和真实勾选读取仍需Windows实机验证。\n'.encode('utf-8'))
with zipfile.ZipFile(patch) as z:assert z.testzip() is None
print('Built',patch.name,patch.stat().st_size,'bytes; portable runtimes are retained.')
