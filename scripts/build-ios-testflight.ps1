# Run from an interactive PowerShell window. Apple credentials stay in the CLI,
# never in this file or the repository. Requires the signed-in Expo account.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$clientDirectory = Join-Path $PSScriptRoot '..\client'
Push-Location $clientDirectory
try {
    Write-Host 'Nine Below iOS: App Store / TestFlight build (not an Android AAB).'
    Write-Host 'Bundle ID: com.potterwell.ninebelow'
    Write-Host 'Enter Apple sign-in and two-factor codes only in the official EAS prompts.'
    Write-Host 'Choose Ninebelow, A Registered Series Of Potterwell LLC (team 63FQJRQ66P).'
    Write-Host 'App Store Connect Apple ID: 6814632886. Do not revoke existing certificates.'
    Write-Host 'If asked, allow EAS to create the distribution profile for this app.'
    & npm.cmd run verify-deps
    if ($LASTEXITCODE -ne 0) { throw 'Dependency validation failed; build stopped.' }
    & npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Type checking failed; build stopped.' }
    & npx.cmd --yes eas-cli@latest build --platform ios --profile testflight
    if ($LASTEXITCODE -ne 0) { throw 'EAS did not finish successfully. Keep the displayed error for diagnosis, without credentials.' }
    Write-Host 'When EAS shows Finished, save its build URL/ID. Submit that exact iOS build to TestFlight.'
    Write-Host 'No public App Store release or tester invitations were performed by this script.'
}
finally {
    Pop-Location
}
