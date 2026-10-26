ragdesk portable (Windows)
==========================

Requirements
  - Windows 10/11
  - Python 3.11+ on PATH (https://www.python.org/ or: winget install Python.Python.3.12)

First run
  1. Unzip this folder anywhere (keep paths without odd Unicode if possible).
  2. Optional: copy .env.example to .env and edit.
  3. Double-click start.cmd
  4. Browser opens http://127.0.0.1:8000

LAN / intranet
  - Default bind is 0.0.0.0 (other PCs can open http://<this-pc-ip>:8000).
  - Allow inbound TCP 8000 in Windows Firewall if needed.
  - Set RAGDESK_API_TOKEN in .env for a shared secret; users paste it in Settings.

Data
  - Uploads / vectors live in .\data\ next to start.cmd. Back up that folder.

Stop
  - Focus the console window and press Ctrl+C.

More: see docs/DEPLOY.md in the source repository.
