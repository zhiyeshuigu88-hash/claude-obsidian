@echo off
cd /d "%~dp0"

if not exist ".next" (
  echo Building Filament Keeper...
  call npm run build
)

start "" http://127.0.0.1:3000
call npm run start
