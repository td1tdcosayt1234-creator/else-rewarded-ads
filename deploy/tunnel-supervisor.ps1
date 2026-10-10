# Else Pay tunnel supervisor - keeps cloudflared alive, restarts on exit
# Token is read from .tunnel-token (gitignored) or passed as -Token.
param(
  [string]$Token = "",
  [string]$LogFile = ""
)
$root = $PSScriptRoot
if (-not $Token -or -not $LogFile) {
  $tf = Join-Path $root ".tunnel-token"
  if (-not (Test-Path $tf)) { $tf = "$env:TEMP\elsepay-tunnel.token" }
  if (-not (Test-Path $tf)) { Write-Error "tunnel token file not found (.tunnel-token)"; exit 1 }
  $Token = ([System.IO.File]::ReadAllText($tf)).Trim()
}
if (-not $LogFile) { $LogFile = "$env:LOCALAPPDATA\Temp\1\opencode\elsepay-tunnel.log" }

$exe = Join-Path $root "cloudflared.exe"
if (-not (Test-Path $exe)) { $exe = Join-Path $env:TEMP "cloudflared.exe" }
if (-not (Test-Path $exe)) {
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile (Join-Path $env:TEMP "cloudflared.exe")
  $exe = Join-Path $env:TEMP "cloudflared.exe"
}

while ($true) {
  $env:TUNNEL_TOKEN = $Token
  & $exe tunnel --no-autoupdate run *>> $LogFile
  Write-Output "$(Get-Date -Format o) cloudflared exited (code $LASTEXITCODE), restarting in 3s" >> $LogFile
  Start-Sleep -Seconds 3
}
