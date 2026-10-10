@echo off
REM ============================================================
REM  Else Pay - start on https://elsepay.indevs.in
REM  NOTE: app has no dotenv dependency, so env vars are set HERE
REM  and inherited by the node child process.
REM ============================================================
setlocal

cd /d "%~dp0.."

REM ---- runtime env (inherited by node) ----
set "PORT=3002"
set "NODE_ENV=production"
set "PUBLIC_URL=https://elsepay.indevs.in"
set "FRONTEND_URL=https://elsepay.indevs.in/app"
set "APP_NAME=Else Pay"

REM ---- admin key from local file (not committed) ----
set "ADMIN_KEY="
if exist "%~dp0.admin-key" (
  set /p ADMIN_KEY=<"%~dp0.admin-key"
) else (
  powershell -NoProfile -Command "$k='else-admin-'+([guid]::NewGuid().ToString('N').Substring(0,16)); [IO.File]::WriteAllText('%~dp0.admin-key',$k); $k" > "%TMPDIR%\newkey.txt"
  set /p ADMIN_KEY=<"%TMPDIR%\newkey.txt"
  echo [config] generated new ADMIN_KEY -^> deploy\.admin-key
)

set "TMPDIR=%LOCALAPPDATA%\Temp\1\opencode"
if not exist "%TMPDIR%" set "TMPDIR=%TEMP%"
set "TID=343eef94-77fb-460a-b5ab-d8b2ab2a278a"

REM ---- Cloudflare API token (NEVER hardcode; read from local file) ----
set "TOKFILE=%~dp0.cf-token"
if not exist "%TOKFILE%" (
  echo [config] missing "%TOKFILE%"
  echo          create it with your Cloudflare API token ^(Zone.DNS + Tunnel edit^)
  echo          example:  echo YOUR_TOKEN ^> deploy\.cf-token
  exit /b 1
)
set /p CFT=<"%TOKFILE%"

echo ============================================
echo  Else Pay  ^(PORT=%PORT%^)
echo ============================================

REM ---- 1. stop anything on our port ----
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo [node] stopping old process on :%PORT%
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
  timeout /t 2 /nobreak >nul
)

echo [node] starting server.js ...
start "" /min node server.js
timeout /t 5 /nobreak >nul
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if %errorlevel%==0 ( echo [node] OK :%PORT% listening ) else ( echo [node] FAILED - see window )

REM ---- 2. locate cloudflared ----
set "CFD="
where cloudflared >nul 2>nul && set "CFD=cloudflared"
if not defined CFD if exist "%TEMP%\cloudflared.exe" set "CFD=%TEMP%\cloudflared.exe"
if not defined CFD (
  echo [cloudflared] downloading...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%TEMP%\cloudflared.exe'"
  set "CFD=%TEMP%\cloudflared.exe"
)

REM ---- 3. tunnel token ----
set "TOKENFILE=%TMPDIR%\tunnel.token"
if not exist "%TOKENFILE%" (
  echo [cloudflared] fetching tunnel token...
  powershell -NoProfile -Command "$t = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/accounts/0df834268d45d3b6c1ebe48c1d3217a7/cfd_tunnel/%TID%/token' -Headers @{Authorization='Bearer %CFT%'}; [IO.File]::WriteAllText('%TOKENFILE%', $t.result)"
)

REM ---- 4. start tunnel ----
tasklist /fi "imagename eq cloudflared.exe" | find "cloudflared.exe" >nul
if %errorlevel%==0 (
  echo [cloudflared] already running
) else (
  echo [cloudflared] connecting tunnel...
  start "" /min "%CFD%" tunnel --no-autoupdate run --token-file "%TOKENFILE%"
  timeout /t 10 /nobreak >nul
)

echo.
echo ============================================
echo  Verifying...
echo ============================================
curl -s -o NUL -w "  /app          -> %%{http_code}\n" https://elsepay.indevs.in/app
curl -s -o NUL -w "  /admin        -> %%{http_code}\n" https://elsepay.indevs.in/admin
curl -s -o NUL -w "  /api/config   -> %%{http_code}\n" https://elsepay.indevs.in/api/config
curl -s -o NUL -w "  api subdomain -> %%{http_code}\n" https://api.elsepay.indevs.in/api/config
echo.
echo  App   : https://elsepay.indevs.in/app
echo  Admin : https://elsepay.indevs.in/admin
echo  API   : https://api.elsepay.indevs.in/api/config
echo  Stop  : deploy\stop-elsepay.bat
echo ============================================
endlocal

