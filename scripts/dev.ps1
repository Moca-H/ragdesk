# Start API + Web together. Usage: .\scripts\dev.ps1
# Keep console messages ASCII-safe: Windows PowerShell often misreads UTF-8 without BOM.
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [Console]::OutputEncoding
} catch {
  # ignore hosts that disallow console encoding changes
}
$Root = Split-Path $PSScriptRoot -Parent
$ApiDir = Join-Path $Root 'apps\api'
$WebDir = Join-Path $Root 'apps\web'
$ApiPort = 8000
$WebPort = 5173

function Ensure-Api {
  Set-Location $ApiDir
  if (-not (Test-Path '.venv\Scripts\python.exe')) {
    Write-Host '>> creating Python venv...'
    python -m venv .venv
  }
  $py = Join-Path $ApiDir '.venv\Scripts\python.exe'
  $uv = Join-Path $ApiDir '.venv\Scripts\uvicorn.exe'
  if (-not (Test-Path $uv)) {
    Write-Host '>> installing API dependencies...'
    & $py -m pip install -r requirements.txt
  }
}

function Ensure-Web {
  Set-Location $WebDir
  if (-not (Test-Path 'node_modules')) {
    Write-Host '>> installing web dependencies...'
    npm install
  }
}

Write-Host 'ragdesk - preparing...'
Ensure-Api
Ensure-Web

$apiPy = Join-Path $ApiDir '.venv\Scripts\python.exe'
$apiJob = Start-Process -FilePath $apiPy -ArgumentList @(
  '-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', "$ApiPort"
) -WorkingDirectory $ApiDir -PassThru -WindowStyle Minimized

$webJob = Start-Process -FilePath 'cmd.exe' -ArgumentList @(
  '/c', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', "$WebPort"
) -WorkingDirectory $WebDir -PassThru -WindowStyle Minimized

Write-Host ''
Write-Host "API  http://127.0.0.1:$ApiPort"
Write-Host "Web  http://127.0.0.1:$WebPort"
Write-Host 'Press Ctrl+C here to stop both.'
Write-Host ''

Start-Sleep -Seconds 2
try {
  Start-Process "http://127.0.0.1:$WebPort"
} catch {
  # ignore browser open failures
}

try {
  Wait-Process -Id $apiJob.Id, $webJob.Id
} finally {
  foreach ($p in @($apiJob, $webJob)) {
    if ($p -and -not $p.HasExited) {
      Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
      # also kill child trees when possible
      Get-CimInstance Win32_Process -Filter "ParentProcessId=$($p.Id)" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    }
  }
  Write-Host 'Stopped.'
}
