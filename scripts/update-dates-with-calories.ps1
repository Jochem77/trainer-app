# PowerShell script to add calorie information to dates in schema.json

$schemaPath = "c:\Users\joche\trainer-app\schema.json"

# Read the JSON content
$content = Get-Content -Path $schemaPath -Raw

# Read as JSON to parse the structure
$jsonData = $content | ConvertFrom-Json

# Update each entry
foreach ($entry in $jsonData) {
    if ($entry.date -and $entry.cal -and -not ($entry.date -like "*cal*")) {
        $oldDate = $entry.date
        $newDate = "$oldDate (cal ±$($entry.cal))"
        $entry.date = $newDate
        Write-Host "Updated: $oldDate -> $newDate"
    }
}

# Convert back to JSON and save
$updatedJson = $jsonData | ConvertTo-Json -Depth 10
$updatedJson | Set-Content -Path $schemaPath -Encoding UTF8

Write-Host "Schema.json updated successfully!"
