@echo off
cd /d "%~dp0"
taskkill /f /im git.exe 2>nul
taskkill /f /im git-remote-https.exe 2>nul
del /f /q .git\index.lock .git\HEAD.lock .git\config.lock 2>nul
del /f /q .git\refs\heads\main.lock 2>nul
echo === deploy start %date% %time% > deploy_log.txt
git add -A >> deploy_log.txt 2>&1
git commit -m "site: fix consulting + add ai-audit and crypto-risk-desk landings" >> deploy_log.txt 2>&1
git push origin main >> deploy_log.txt 2>&1
echo === DONE exit=%errorlevel% >> deploy_log.txt
