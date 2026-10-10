@echo off
REM Detach the Else Pay tunnel supervisor so it survives the parent shell.
REM (cmd "start" creates a new session; powershell Start-Process children
REM  get killed with the invoking shell in some harnesses.)
setlocal
cd /d "%~dp0"
if not exist "%~dp0.tunnel-token" (
  if exist "%LOCALAPPDATA%\Temp\1\opencode\elsepay-tunnel.token" (
    copy /y "%LOCALAPPDATA%\Temp\1\opencode\elsepay-tunnel.token" "%~dp0.tunnel-token" >nul
  )
)
start "elsepay-tunnel" /min powershell -ExecutionPolicy Bypass -File "%~dp0tunnel-supervisor.ps1"
echo started tunnel supervisor -^> https://elsepay.indevs.in
timeout /t 6 /nobreak >nul
tasklist /fi "imagename eq cloudflared.exe" | find "cloudflared.exe" >nul && echo cloudflared: running || echo cloudflared: NOT running
endlocal
