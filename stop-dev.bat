@echo off
REM stop-dev.bat - Arrete les serveurs de dev (double-clic)
powershell -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"
pause
