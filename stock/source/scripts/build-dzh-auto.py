"""Bundle source-only Windows client; no credentials, user data or runtimes."""
from pathlib import Path
import json
import zipfile
root=Path(__file__).resolve().parent.parent
client=root/'windows-dzh-auto'
engine=['strategy-config.js','dzh-dad.js','macd.js','signal-model.js','conclusion.js','indicators.js','research.js','providers.js','pool-model.js']
out=root.parent/'dzh-daily-auto.zip'
prefix='大智慧收盘自动更新/'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr(prefix+'source/package.json',json.dumps({'private':True,'type':'module'}))
    for name in engine:z.write(root/name,prefix+'source/'+name)
    allowed=['worker.mjs','export-ui.ps1','run.ps1','setup.ps1','remove-task.ps1','01安装与首次连接.cmd','02立即更新.cmd','03移除定时任务.cmd','使用说明.txt']
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
