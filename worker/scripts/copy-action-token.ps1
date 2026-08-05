$ErrorActionPreference = 'Stop'

$secretPath = Join-Path $PSScriptRoot '..\.secrets\action-token.clixml'
if (-not (Test-Path -LiteralPath $secretPath)) {
    throw 'No locally encrypted LifeQuest Action token exists.'
}

$secureToken = Import-Clixml -LiteralPath $secretPath
$token = [System.Net.NetworkCredential]::new('', $secureToken).Password
Set-Clipboard -Value $token

Write-Output 'The LifeQuest Action token is now on the clipboard.'
