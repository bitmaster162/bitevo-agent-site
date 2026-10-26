param([string]$EvidenceRoot='D:\BITEVO_R50H_LOCAL_EVIDENCE_20261026_R3')
$ErrorActionPreference='Stop'
$repo=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if((git -C $repo rev-parse HEAD).Trim() -ne '685c9833db261dd3f39d8edcd663290b11b5f0e3'){
 throw 'STOP_BASELINE_CHANGED; use reviewed R50-H base before running'
}
$config=Get-Content -LiteralPath (Join-Path $repo 'wrangler.r50h-staging.jsonc') -Raw
if($config -match 'b533a76e|1de9ec7f|bitevo-events-b12|ai-skill-lab-leads'){throw 'STOP_PRODUCTION_DB_BOUND'}
if($config -notmatch '00000000-0000-0000-0000-000000000000'){throw 'STOP_TEMPLATE_CLOUD_ID_PRESENT'}
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
node (Join-Path $repo 'scripts/r50h/local-trial.mjs') $EvidenceRoot
if($LASTEXITCODE -ne 0){throw 'STOP_MINIFLARE_FAILURE'}
node --test (Join-Path $repo 'tests/b1-2-r50g3l2-entry-local.test.mjs') (Join-Path $repo 'tests/b1-2-r50g3l3-dedup-local.test.mjs') | Out-File (Join-Path $EvidenceRoot 'regression.stdout.log') -Encoding utf8
if($LASTEXITCODE -ne 0){throw 'STOP_REGRESSION_FAILURE'}
$case=Get-Content (Join-Path $EvidenceRoot 'local-trial-result.json') -Raw | ConvertFrom-Json
if($case.status -ne 'PASS' -or @($case.scenarios | Where-Object {$_.status -ne 'PASS'}).Count -ne 0){throw 'STOP_CASE_FAIL'}
$names=@('local-trial-result.json','regression.stdout.log')
$manifest=@($names | ForEach-Object {
 $p=Join-Path $EvidenceRoot $_
 [ordered]@{file=$_;sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item $p).Length}
})
$receipt=[ordered]@{document='R50H_LOCAL_RUN_RECEIPT';status='PASS_LOCAL_ONLY';timestamp=(Get-Date).ToUniversalTime().ToString('o');baseline='685c9833db261dd3f39d8edcd663290b11b5f0e3';cases=$case.scenarios.Count;cleaned=$case.cleanup;files=$manifest;cloudWrites=0;productionWrites=0}
$receipt|ConvertTo-Json -Depth 16|Set-Content (Join-Path $EvidenceRoot 'receipt.json') -Encoding UTF8
Write-Output ('R50H_LOCAL_PASS='+$case.scenarios.Count)
Write-Output ('RECEIPT='+ (Join-Path $EvidenceRoot 'receipt.json'))
