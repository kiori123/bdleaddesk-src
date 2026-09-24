@echo off
REM Bam doi vao file nay de deploy. Khong can go lenh, khong can mo PowerShell truoc.
REM
REM %~dp0 la thu muc chua chinh file nay, nen no luon deploy dung folder
REM dang dat file, khong bao gio nham sang ban cu trong home.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
