# Script om database schema te resetten naar originele schema.json
# Dit script werkt alleen als je toegang hebt tot de Supabase database

Write-Host "Database schema resetten naar originele schema.json..." -ForegroundColor Yellow

# Lees het schema.json bestand
$schemaPath = Join-Path $PSScriptRoot "schema.json"
if (!(Test-Path $schemaPath)) {
    Write-Host "schema.json niet gevonden in $schemaPath" -ForegroundColor Red
    exit 1
}

$schemaContent = Get-Content $schemaPath -Raw | ConvertFrom-Json
Write-Host "Schema.json bevat $($schemaContent.Count) weken met training data" -ForegroundColor Green

# Converteer terug naar JSON string voor database opslag
$schemaJson = $schemaContent | ConvertTo-Json -Depth 10 -Compress

Write-Host "Schema data geconverteerd naar JSON format" -ForegroundColor Green
Write-Host "Je moet dit handmatig uitvoeren in je Supabase dashboard:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ga naar je Supabase project dashboard" -ForegroundColor White
Write-Host "2. Open de SQL Editor" -ForegroundColor White
Write-Host "3. Voer de volgende SQL query uit:" -ForegroundColor White
Write-Host ""

# Genereer SQL query
$sql = @"
-- Reset user schema naar originele schema.json data
-- VERVANG 'YOUR_USER_ID' met je echte user ID

UPDATE user_schemas 
SET 
    schema_data = '$($schemaJson.Replace("'", "''"))',
    schema_name = 'Origineel Trainingsschema',
    is_active = true,
    updated_at = NOW()
WHERE user_id = 'YOUR_USER_ID';

-- Als er geen record bestaat, insert dan een nieuwe:
INSERT INTO user_schemas (user_id, schema_data, schema_name, is_active, created_at, updated_at)
SELECT 'YOUR_USER_ID', '$($schemaJson.Replace("'", "''"))', 'Origineel Trainingsschema', true, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM user_schemas WHERE user_id = 'YOUR_USER_ID'
);
"@

Write-Host $sql -ForegroundColor Gray
Write-Host ""
Write-Host "4. Vervang 'YOUR_USER_ID' met je echte user ID uit de auth.users tabel" -ForegroundColor Yellow
Write-Host "5. Voer de query uit" -ForegroundColor White
Write-Host ""
Write-Host "Alternatief: gebruik het Node.js script 'reset-database-schema.js'" -ForegroundColor Cyan

# Schrijf SQL ook naar bestand voor makkelijk kopiëren
$sqlFile = Join-Path $PSScriptRoot "reset-schema.sql"
$sql | Out-File -FilePath $sqlFile -Encoding UTF8
Write-Host "SQL query opgeslagen in: $sqlFile" -ForegroundColor Green