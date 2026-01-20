@echo off
set "PROJECT_DIR=C:\Users\Umair\OneDrive\Desktop\Work\Random_Projects\LifeQuest"
cd /d "%PROJECT_DIR%"

:: Check if the server is specifically LISTENING on port 5173
netstat -ano | findstr :5173 | findstr LISTENING > nul
if %errorlevel% neq 0 (
    echo Starting dev server...
    :: Start npm run dev in the background
    start /b npm run dev
    :: Wait for the server to spin up (Vite can take a few seconds)
    timeout /t 8 /nobreak > nul
)

:: Final check if server is up
netstat -ano | findstr :5173 > nul
if %errorlevel% neq 0 (
    :: Server failed or taking too long
    msg %username% "LifeQuest server is still starting. Please wait a few seconds and try again, or check the terminal."
)

:: Launch the Brave PWA
start "" "C:\Program Files\BraveSoftware\Brave-Browser\Application\chrome_proxy.exe" --profile-directory=Default --app-id=idemibpphagihbobmgmaojhjfidlfpdl
