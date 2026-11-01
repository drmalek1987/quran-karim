@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "Get-Content progress.txt -Tail 20 -Wait -Encoding UTF8"
