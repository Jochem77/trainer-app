# SharePoint Online Recycle Bin Restore - Setup Instructies

Write-Host "SharePoint Online Recycle Bin Restore Script" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

Write-Host "`n1. VEREISTEN:" -ForegroundColor Yellow
Write-Host "   - Windows PowerShell 5.1 of PowerShell 7+" -ForegroundColor White
Write-Host "   - Administrator rechten voor module installatie" -ForegroundColor White  
Write-Host "   - SharePoint Online toegang tot de site" -ForegroundColor White

Write-Host "`n2. INSTALLATIE:" -ForegroundColor Yellow
Write-Host "   Het script installeert automatisch de PnP.PowerShell module" -ForegroundColor White
Write-Host "   Als dit niet werkt, installeer handmatig:" -ForegroundColor White
Write-Host "   Install-Module -Name PnP.PowerShell -Force -AllowClobber" -ForegroundColor Gray

Write-Host "`n3. GEBRUIK:" -ForegroundColor Yellow
Write-Host "   Optie A - Direct uitvoeren:" -ForegroundColor White
Write-Host "   .\Run-Restore.ps1" -ForegroundColor Gray
Write-Host "`n   Optie B - Met eigen parameters:" -ForegroundColor White  
Write-Host "   .\Restore-SharePointRecycleBin.ps1 -SiteUrl 'jouw-site' -UserEmail 'jouw-email' -FromDateTime '2025-11-13 16:30'" -ForegroundColor Gray
Write-Host "`n   Optie C - Eerst controleren (geen wijzigingen):" -ForegroundColor White
Write-Host "   .\Restore-SharePointRecycleBin.ps1 -WhatIf" -ForegroundColor Gray

Write-Host "`n4. HUIDIGE INSTELLINGEN:" -ForegroundColor Yellow
Write-Host "   Site: https://skorscholen.sharepoint.com/sites/deachtbaanportaal" -ForegroundColor White
Write-Host "   Gebruiker: jochem.steenbakkers@skor-scholen.nl" -ForegroundColor White  
Write-Host "   Vanaf: 13-11-2025 16:30" -ForegroundColor White

Write-Host "`n5. BEVEILIGING:" -ForegroundColor Yellow
Write-Host "   - Script vraagt om bevestiging voor terugzetten" -ForegroundColor White
Write-Host "   - Gebruik -WhatIf om eerst te controleren" -ForegroundColor White
Write-Host "   - Er wordt een CSV export gemaakt van alle acties" -ForegroundColor White

Write-Host "`n6. PROBLEMEN OPLOSSEN:" -ForegroundColor Yellow
Write-Host "   - Controleer of je toegang hebt tot de SharePoint site" -ForegroundColor White
Write-Host "   - Zorg dat je rechten hebt om items terug te zetten" -ForegroundColor White
Write-Host "   - Check of de datum/tijd correct is (formaat: yyyy-MM-dd HH:mm:ss)" -ForegroundColor White

Write-Host "`nDruk op een toets om te beginnen..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")