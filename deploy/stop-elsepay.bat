@echo off
REM Stop Else Pay (node server + cloudflared tunnel)
echo Stopping node server on :3002 ...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo Stopping cloudflared ...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo Done.
pause
