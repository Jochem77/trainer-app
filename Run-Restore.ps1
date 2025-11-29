# Eenvoudige configuratie versie
# Pas onderstaande variabelen aan indien nodig

$SiteUrl = "https://skorscholen.sharepoint.com/sites/deachtbaanportaal"
$UserEmail = "jochem.steenbakkers@skor-scholen.nl" 
$FromDateTime = Get-Date "2025-11-13 16:30:00"

# Voer het hoofdscript uit met de instellingen
& "$PSScriptRoot\Restore-SharePointRecycleBin.ps1" -SiteUrl $SiteUrl -UserEmail $UserEmail -FromDateTime $FromDateTime

# Om alleen te bekijken wat er terugzezet zou worden (zonder daadwerkelijk terug te zetten):
# & "$PSScriptRoot\Restore-SharePointRecycleBin.ps1" -SiteUrl $SiteUrl -UserEmail $UserEmail -FromDateTime $FromDateTime -WhatIf