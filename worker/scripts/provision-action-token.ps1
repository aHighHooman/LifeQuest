$ErrorActionPreference = 'Stop'

$secretDirectory = Join-Path $PSScriptRoot '..\.secrets'
$secretPath = Join-Path $secretDirectory 'action-token.clixml'
$configPath = Join-Path $PSScriptRoot '..\wrangler.jsonc'

$randomBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$token = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

$token |
    npx wrangler secret put LIFEQUEST_ACTION_TOKEN --config $configPath
if ($LASTEXITCODE -ne 0) {
    throw 'Cloudflare rejected the LifeQuest Action token.'
}

New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
ConvertTo-SecureString -String $token -AsPlainText -Force |
    Export-Clixml -LiteralPath $secretPath

Write-Output 'The LifeQuest Action token was uploaded and encrypted for this Windows user.'
