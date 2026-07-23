@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在啟動網頁精靈…
if not exist "WebWizard.exe" (
  echo 找不到 WebWizard.exe，請先下載到這個資料夾。
  pause
  exit /b 1
)
start "" "WebWizard.exe"
