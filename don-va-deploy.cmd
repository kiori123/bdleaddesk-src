@echo off
REM Bam doi vao file nay de don folder cu roi deploy.
REM %~dp0 la thu muc chua chinh file nay, nen no luon chay dung folder dang dat file.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0don-va-deploy.ps1"
