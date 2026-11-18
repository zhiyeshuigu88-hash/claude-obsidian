# Launcher for the kyosuke Discord bot (called by Task Scheduler).
# Appends output to bot.log and restarts the bot automatically if it exits.
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 misreads BOM-less UTF-8).
Set-Location -LiteralPath $PSScriptRoot

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Log($msg) {
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg" | Add-Content -Encoding UTF8 bot.log
}

$delay = 5
while ($true) {
  $started = Get-Date
  Write-Log 'starting bot'
  & $node --env-file=.env index.js 2>&1 | ForEach-Object { "$_" | Add-Content -Encoding UTF8 bot.log }
  Write-Log "bot exited (code $LASTEXITCODE)"

  # Ran for a while -> reset backoff; crashed right away -> wait longer (max 5 min)
  if (((Get-Date) - $started).TotalSeconds -gt 60) { $delay = 5 } else { $delay = [Math]::Min($delay * 2, 300) }
  Write-Log "restarting in $delay s"
  Start-Sleep -Seconds $delay
}
