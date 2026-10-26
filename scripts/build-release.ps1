# Build a Windows portable package under release/ragdesk-portable/
# Usage: .\scripts\build-release.ps1
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [Console]::OutputEncoding
} catch {}

$Root = Split-Path $PSScriptRoot -Parent
$ApiDir = Join-Path $Root 'apps\api'
$WebDir = Join-Path $Root 'apps\web'
$OutRoot = Join-Path $Root 'release'
$PkgName = 'ragdesk-portable'
$PkgDir = Join-Path $OutRoot $PkgName
$ZipPath = Join-Path $OutRoot "$PkgName.zip"

Write-Host '==> building web...'
Push-Location $WebDir
try {
  if (-not (Test-Path 'node_modules')) {
    npm ci
  }
  npm run build
} finally {
  Pop-Location
}

$WebDist = Join-Path $WebDir 'dist'
if (-not (Test-Path (Join-Path $WebDist 'index.html'))) {
  throw "Web build missing: $WebDist\index.html"
}

Write-Host '==> assembling package...'
if (Test-Path $PkgDir) {
  Remove-Item -Recurse -Force $PkgDir
}
New-Item -ItemType Directory -Path $PkgDir | Out-Null

Copy-Item -Recurse (Join-Path $ApiDir 'app') (Join-Path $PkgDir 'app')
Copy-Item -Recurse (Join-Path $ApiDir 'sample') (Join-Path $PkgDir 'sample')
Copy-Item (Join-Path $ApiDir 'requirements.txt') (Join-Path $PkgDir 'requirements.txt')
Copy-Item -Recurse $WebDist (Join-Path $PkgDir 'static')

Copy-Item (Join-Path $Root 'scripts\release\start.cmd') (Join-Path $PkgDir 'start.cmd')
Copy-Item (Join-Path $Root 'scripts\release\start.ps1') (Join-Path $PkgDir 'start.ps1')
Copy-Item (Join-Path $Root 'scripts\release\env.example') (Join-Path $PkgDir '.env.example')
Copy-Item (Join-Path $Root 'scripts\release\README.txt') (Join-Path $PkgDir 'README.txt')

# Drop bytecode / caches if any slipped in
Get-ChildItem -Path $PkgDir -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host '==> zipping...'
if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}
Compress-Archive -Path $PkgDir -DestinationPath $ZipPath -CompressionLevel Optimal

Write-Host ''
Write-Host "OK  folder: $PkgDir"
Write-Host "OK  zip:    $ZipPath"
Write-Host 'Unzip on a PC with Python 3.11+, then run start.cmd'
