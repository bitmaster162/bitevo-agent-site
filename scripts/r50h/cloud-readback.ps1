param(
 [Parameter(Mandatory)][string]$DatabaseId,
 [string]$ExpectedName='bitevo-r50-staging-20261026',
 [string]$Wrangler='C:\Users\coins\AppData\Local\npm-cache\_npx\0d005330ba397783\node_modules\.bin\wrangler.cmd'
)
$ErrorActionPreference='Stop'
if($ExpectedName -cne 'bitevo-r50-staging-20261026'){throw 'STOP_UNEXPECTED_NAME'}
if($DatabaseId -notmatch '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'){throw 'STOP_UUID'}
if($DatabaseId -in @('b533a76e-ddd0-406b-9449-94e878bc2c50','1de9ec7f-5d92-4edd-a069-ec5296b54b82')){throw 'STOP_PRODUCTION_DATABASE'}
if(-not(Test-Path -LiteralPath $Wrangler)){throw 'STOP_WRANGLER_ABSENT'}
$raw=& $Wrangler d1 list --json 2>&1
if($LASTEXITCODE -ne 0){throw 'STOP_D1_AUTH_OR_API_ERROR'}
$rows=@($raw | Out-String | ConvertFrom-Json)
$hit=@($rows | Where-Object { $_.name -ceq $ExpectedName -and $_.uuid -ceq $DatabaseId })
if($hit.Count -ne 1){throw 'STOP_NAME_UUID_PROVIDER_MISMATCH'}
$repo=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$q=@(
 "SELECT 'grants' AS table_name,COUNT(*) AS n FROM bitevo_r50_operator_grants",
 "SELECT 'ledger' AS table_name,COUNT(*) AS n FROM bitevo_r50_event_request_ledger",
 "SELECT 'aggregate' AS table_name,COUNT(*) AS n FROM bitevo_public_event_daily"
)
Write-Output ('PROVIDER_ID_VERIFIED='+$DatabaseId)
foreach($sql in $q){
 & $Wrangler d1 execute $ExpectedName --remote --command $sql --json --cwd $repo
 if($LASTEXITCODE -ne 0){throw 'STOP_READBACK_QUERY_FAILED'}
}
