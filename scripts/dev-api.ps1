Set-Location (Join-Path $PSScriptRoot '..\apps\api')
if (-not (Test-Path '.venv')) {
  python -m venv .venv
}
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
