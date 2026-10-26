# Launch ragdesk portable package (same folder as this script).
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [Console]::OutputEncoding
} catch {}

$Root = $PSScriptRoot
Set-Location $Root

# Load .env if present (KEY=VALUE lines; no export syntax).
$EnvFile = Join-Path $Root '.env'
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
  }
}

$hostBind = if ($env:RAGDESK_HOST) { $env:RAGDESK_HOST } else { '0.0.0.0' }
$port = if ($env:RAGDESK_PORT) { $env:RAGDESK_PORT } else { '8000' }
$env:RAGDESK_STATIC_DIR = Join-Path $Root 'static'

function Find-Python {
  foreach ($cmd in @('py', 'python', 'python3')) {
    $p = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $p) { continue }
    try {
      $ver = & $p.Source -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
      if ($LASTEXITCODE -ne 0) { continue }
      $parts = $ver.Trim().Split('.')
      $major = [int]$parts[0]
      $minor = [int]$parts[1]
      if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 11)) {
        return $p.Source
      }
    } catch {
      continue
    }
  }
  return $null
}

$py = Find-Python
if (-not $py) {
  Write-Host 'ERROR: need Python 3.11+ on PATH (python.org or winget install Python.Python.3.12)'
  exit 1
}

$venvPy = Join-Path $Root '.venv\Scripts\python.exe'
$venvUv = Join-Path $Root '.venv\Scripts\uvicorn.exe'
if (-not (Test-Path $venvPy)) {
  Write-Host '>> creating venv...'
  & $py -m venv (Join-Path $Root '.venv')
}
if (-not (Test-Path $venvUv)) {
  Write-Host '>> installing dependencies (first run may take a few minutes)...'
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r (Join-Path $Root 'requirements.txt')
}

Write-Host ''
Write-Host "ragdesk  http://127.0.0.1:$port"
Write-Host "bind     ${hostBind}:$port  (LAN clients use this machine's IP)"
Write-Host 'Ctrl+C to stop.'
Write-Host ''

Start-Sleep -Seconds 1
try {
  Start-Process "http://127.0.0.1:$port"
} catch {}

& $venvPy -m uvicorn app.main:app --host $hostBind --port $port
