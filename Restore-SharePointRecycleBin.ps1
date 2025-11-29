# SharePoint Online Recycle Bin Restore Script
# Terugzetten van bestanden uit de prullenbak vanaf een specifieke datum/tijd en persoon

param(
    [Parameter(Mandatory=$false)]
    [string]$SiteUrl = "https://skorscholen.sharepoint.com/sites/deachtbaanportaal",
    
    [Parameter(Mandatory=$false)]
    [string]$UserEmail = "jochem.steenbakkers@skor-scholen.nl",
    
    [Parameter(Mandatory=$false)]
    [DateTime]$FromDateTime = (Get-Date "2025-11-13 16:30:00"),
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf = $false
)

# Check if PnP PowerShell module is installed
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "PnP.PowerShell module is not installed. Installing..." -ForegroundColor Yellow
    try {
        Install-Module -Name PnP.PowerShell -Force -AllowClobber -Scope CurrentUser
        Write-Host "PnP.PowerShell module installed successfully." -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to install PnP.PowerShell module: $($_.Exception.Message)"
        exit 1
    }
}

# Import the module
Import-Module PnP.PowerShell -Force

try {
    # Connect to SharePoint Online
    Write-Host "Connecting to SharePoint site: $SiteUrl" -ForegroundColor Cyan
    Connect-PnPOnline -Url $SiteUrl -Interactive
    
    Write-Host "Connected successfully!" -ForegroundColor Green
    
    # Get all items from first stage recycle bin
    Write-Host "Retrieving items from recycle bin..." -ForegroundColor Cyan
    $recycleBinItems = Get-PnPRecycleBinItem
    
    if ($recycleBinItems.Count -eq 0) {
        Write-Host "No items found in recycle bin." -ForegroundColor Yellow
        return
    }
    
    Write-Host "Found $($recycleBinItems.Count) items in recycle bin." -ForegroundColor Green
    
    # Filter items based on criteria
    $filteredItems = $recycleBinItems | Where-Object {
        $_.DeletedByEmail -eq $UserEmail -and 
        $_.DeletedDate -ge $FromDateTime
    }
    
    if ($filteredItems.Count -eq 0) {
        Write-Host "No items found matching the criteria:" -ForegroundColor Yellow
        Write-Host "  - Deleted by: $UserEmail" -ForegroundColor Yellow
        Write-Host "  - Deleted after: $($FromDateTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Yellow
        return
    }
    
    Write-Host "`nFound $($filteredItems.Count) items matching criteria:" -ForegroundColor Green
    Write-Host "=" * 80 -ForegroundColor Gray
    
    # Display items that will be restored
    $itemsToRestore = @()
    foreach ($item in $filteredItems) {
        $itemInfo = [PSCustomObject]@{
            Title = $item.Title
            OriginalLocation = $item.DirName
            DeletedDate = $item.DeletedDate.ToString('yyyy-MM-dd HH:mm:ss')
            DeletedBy = $item.DeletedByName
            Size = if ($item.Size) { [math]::Round($item.Size / 1KB, 2).ToString() + " KB" } else { "N/A" }
            Id = $item.Id
        }
        $itemsToRestore += $itemInfo
        
        Write-Host "Title: $($item.Title)" -ForegroundColor White
        Write-Host "Location: $($item.DirName)" -ForegroundColor Gray
        Write-Host "Deleted: $($item.DeletedDate.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
        Write-Host "By: $($item.DeletedByName)" -ForegroundColor Gray
        Write-Host "Size: $(if ($item.Size) { [math]::Round($item.Size / 1KB, 2).ToString() + ' KB' } else { 'N/A' })" -ForegroundColor Gray
        Write-Host "-" * 40 -ForegroundColor Gray
    }
    
    if ($WhatIf) {
        Write-Host "`n[WHATIF MODE] - No items will be restored. Above items would be restored." -ForegroundColor Yellow
        return
    }
    
    # Confirm restoration
    $confirmation = Read-Host "`nDo you want to restore these $($filteredItems.Count) items? (Y/N)"
    if ($confirmation -notin @('Y', 'y', 'Yes', 'yes', 'YES')) {
        Write-Host "Restoration cancelled by user." -ForegroundColor Yellow
        return
    }
    
    # Restore items
    Write-Host "`nStarting restoration..." -ForegroundColor Cyan
    $successCount = 0
    $errorCount = 0
    
    foreach ($item in $filteredItems) {
        try {
            Write-Host "Restoring: $($item.Title)" -ForegroundColor White
            Restore-PnPRecycleBinItem -Identity $item.Id -Force
            $successCount++
            Write-Host "  ✓ Successfully restored" -ForegroundColor Green
        }
        catch {
            $errorCount++
            Write-Host "  ✗ Failed to restore: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Summary
    Write-Host "`n" + "=" * 80 -ForegroundColor Gray
    Write-Host "RESTORATION SUMMARY" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Gray
    Write-Host "Total items processed: $($filteredItems.Count)" -ForegroundColor White
    Write-Host "Successfully restored: $successCount" -ForegroundColor Green
    Write-Host "Failed: $errorCount" -ForegroundColor Red
    
    if ($successCount -gt 0) {
        Write-Host "`nSuccessfully restored $successCount items!" -ForegroundColor Green
        Write-Host "Check the original locations to verify the files are back." -ForegroundColor Cyan
    }
}
catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    Write-Host "Stack trace:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
}
finally {
    # Disconnect from SharePoint
    try {
        Disconnect-PnPOnline
        Write-Host "`nDisconnected from SharePoint." -ForegroundColor Gray
    }
    catch {
        # Ignore disconnect errors
    }
}

# Export results to CSV for reference
if ($itemsToRestore -and $itemsToRestore.Count -gt 0) {
    $csvPath = "SharePoint_Restored_Items_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
    $itemsToRestore | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Host "Item details exported to: $csvPath" -ForegroundColor Cyan
}