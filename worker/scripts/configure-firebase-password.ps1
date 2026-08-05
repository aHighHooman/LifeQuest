$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'LifeQuest Firebase Agent Setup'

$configPath = Join-Path $PSScriptRoot '..\wrangler.jsonc'
$statusDirectory = Join-Path $PSScriptRoot '..\.secrets'
$statusPath = Join-Path $statusDirectory 'firebase-password-configured'
$envPath = Join-Path $PSScriptRoot '..\..\.env.local'
$agentEmail = [Environment]::GetEnvironmentVariable('LIFEQUEST_FIREBASE_LLM_EMAIL')
$expectedUid = [Environment]::GetEnvironmentVariable('LIFEQUEST_LLM_UID')

if ([string]::IsNullOrWhiteSpace($agentEmail) -or [string]::IsNullOrWhiteSpace($expectedUid)) {
    throw 'Set LIFEQUEST_FIREBASE_LLM_EMAIL and LIFEQUEST_LLM_UID in the protected environment before running this script.'
}

New-Item -ItemType Directory -Path $statusDirectory -Force | Out-Null
Remove-Item -LiteralPath $statusPath -Force -ErrorAction SilentlyContinue

$apiKeyLine = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match '^VITE_FIREBASE_API_KEY=' } |
    Select-Object -First 1
if (-not $apiKeyLine) {
    throw 'The Firebase API key was not found in .env.local.'
}
$apiKey = $apiKeyLine.Substring('VITE_FIREBASE_API_KEY='.Length).Trim()

Write-Host ''
Write-Host 'Enter the EXISTING password for the configured Firebase agent account.' -ForegroundColor Cyan
Write-Host 'This is the dedicated Firebase agent account, not your main Google account.'
Write-Host 'The password stays hidden and is sent directly to Cloudflare as an encrypted secret.'
Write-Host ''

$securePassword = Read-Host 'Agent password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw 'No password was entered.'
    }

    $signInBody = @{
        email = $agentEmail
        password = $plainPassword
        returnSecureToken = $true
    } | ConvertTo-Json
    try {
        $signInResult = Invoke-RestMethod `
            -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" `
            -Method Post `
            -ContentType 'application/json' `
            -Body $signInBody
    } catch {
        throw 'Firebase rejected that agent password. No Cloudflare secret was changed.'
    }
    if ($signInResult.localId -ne $expectedUid) {
        throw 'That password authenticated the wrong Firebase account.'
    }

    $plainPassword |
        npx wrangler secret put FIREBASE_LLM_PASSWORD --config $configPath
    if ($LASTEXITCODE -ne 0) {
        throw 'Cloudflare rejected the Firebase agent password.'
    }

    New-Item -ItemType File -Path $statusPath -Force | Out-Null
    Write-Host ''
    Write-Host 'Success. The Firebase agent password is configured.' -ForegroundColor Green
} finally {
    $plainPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

Write-Host ''
Read-Host 'Press Enter to close this window'
