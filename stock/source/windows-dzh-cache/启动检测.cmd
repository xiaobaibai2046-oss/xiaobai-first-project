@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-cache.ps1"
echo.
echo 检测结束。请查看同目录的结果压缩包，检查后发回聊天。
pause
