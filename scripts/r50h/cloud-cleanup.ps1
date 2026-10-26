param(
 [Parameter(Mandatory)][string]$DatabaseId,
 [switch]$Execute,
 [string]$Wrangler='C:\Users\coins\AppData\Local\npm-cache\_npx\0d005330ba397783\node_modules\.bin\wrangler.cmd'
)
$ErrorActionPreference='Stop'
if(-not $Execute){throw 'DRY_ONLY_USE_-Execute_AFTER_PROVIDER_ID_VERIFICATION'}
& (Join-Path $PSScriptRoot 'cloud-readback.ps1') -DatabaseId $DatabaseId -Wrangler $Wrangler
if($LASTEXITCODE -ne 0){throw 'STOP_READBACK_FAILED'}
$db='bitevo-r50-staging-20261026'
$repo=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
foreach($table in @('bitevo_r50_event_request_ledger','bitevo_public_event_daily','bitevo_r50_operator_grants')){
 & $Wrangler d1 execute $db --remote --command ("DELETE FROM "+$table) --yes --cwd $repo
 if($LASTEXITCODE -ne 0){throw ('STOP_CLEANUP_UNCONFIRMED_'+$table)}
}
& (Join-Path $PSScriptRoot 'cloud-readback.ps1') -DatabaseId $DatabaseId -Wrangler $Wrangler
if($LASTEXITCODE -ne 0){throw 'STOP_POST_CLEANUP_READBACK'}
Write-Output 'CLEANUP_ATTEMPTED; VERIFY ALL THREE COUNTS=0 IN PROVIDER OUTPUT'
Write-Output 'D1 TIME_TRAVEL_AND_PROVIDER_LOGS_CAN_PERSIST_BY_PROVIDER_POLICY'
