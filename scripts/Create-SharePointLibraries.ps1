# PowerShell ISE 5.1 Script voor het aanmaken van SharePoint Document Libraries
# Vereisten: PnP PowerShell module
# Auteur: SharePoint Automation Script
# Datum: $(Get-Date)

#Requires -Version 5.1

param(
    [Parameter(Mandatory=$false)]
    [string]$SiteUrl = "https://skorscholen.sharepoint.com/sites/FlorisRadewijnszPortaal",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

# Import required modules
Write-Host "Controleren van vereiste modules..." -ForegroundColor Yellow

# Check if PnP PowerShell is installed
if (-not (Get-Module -ListAvailable -Name "PnP.PowerShell")) {
    Write-Host "PnP.PowerShell module niet gevonden. Installeren..." -ForegroundColor Yellow
    try {
        Install-Module -Name "PnP.PowerShell" -Force -AllowClobber -Scope CurrentUser
        Write-Host "PnP.PowerShell module succesvol geïnstalleerd." -ForegroundColor Green
    }
    catch {
        Write-Error "Kon PnP.PowerShell module niet installeren: $($_.Exception.Message)"
        exit 1
    }
}

# Import PnP PowerShell
Import-Module PnP.PowerShell -Force

# Define the document libraries to create
$Werkmappen = @(
    @{ Title="Werkmap team";               Desc="Werkmap team" },
    @{ Title="Werkmap lesmateriaal";       Desc="Werkmap lesmateriaal" },
    @{ Title="Werkmap administratie";      Desc="Werkmap administratie" },
    @{ Title="Werkmap directie";           Desc="Werkmap directie" },
    @{ Title="Werkmap FFI";                Desc="Werkmap FFI" },
    @{ Title="Werkmap ICT";                Desc="Werkmap ICT" },
    @{ Title="Werkmap Kompas";             Desc="Werkmap Kompas" },
    @{ Title="Werkmap MR";                 Desc="Werkmap MR" },
    @{ Title="Werkmap MT";                 Desc="Werkmap MT" },
    @{ Title="Werkmap Onderwijs";          Desc="Werkmap Onderwijs" },
    @{ Title="Werkmap Personeel";          Desc="Werkmap Personeel" },
    @{ Title="Werkmap Vertrouwenspersoon"; Desc="Werkmap Vertrouwenspersoon" },
    @{ Title="Werkmap Zorg";               Desc="Werkmap Zorg" }
)

# JSON format for command bar customization
$CommandBarJson = @'
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/row-formatting.schema.json",
  "commandBarProps": {
    "commands": [
      {
        "key": "new",
        "position": 1
      },
      {
        "key": "upload",
        "position": 2
      },
      {
        "key": "sync",
        "position": 3
      },
      {
        "key": "export",
        "position": 4
      },
      {
        "key": "share",
        "position": 5
      },
      {
        "key": "automate",
        "hide": true
      },
      {
        "key": "integrate",
        "hide": true
      },
      {
        "key": "editInGridView",
        "hide": true
      },
      {
        "key": "addShortcut",
        "hide": true
      },
      {
        "key": "pinToQuickAccess",
        "hide": true
      },
      {
        "key": "export",
        "hide": true
      },
      {
        "key": "alertMe",
        "hide": true
      },
      {
        "key": "manageAlert",
        "hide": true
      },
      {
        "key": "uploadTemplate",
        "hide": true
      },
      {
        "key": "copyLink",
        "hide": false
      },
      {
        "key": "editNewMenu",
        "hide": true
      },
      {
        "key": "download",
        "hide": true
      }
    ]
  }
}
'@

# Function to create document library with custom formatting
function New-CustomDocumentLibrary {
    param(
        [string]$Title,
        [string]$Description,
        [string]$JsonFormat
    )
    
    try {
        Write-Host "Aanmaken van documentbibliotheek: $Title" -ForegroundColor Cyan
        
        # Check if library already exists
        $existingList = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
        if ($existingList -and -not $Force) {
            Write-Host "  Documentbibliotheek '$Title' bestaat al. Gebruik -Force om te overschrijven." -ForegroundColor Yellow
            return $existingList
        }
        elseif ($existingList -and $Force) {
            Write-Host "  Verwijderen bestaande documentbibliotheek '$Title'..." -ForegroundColor Yellow
            Remove-PnPList -Identity $Title -Force
            Start-Sleep -Seconds 2
        }
        
        # Create the document library
        $newList = New-PnPList -Title $Title -Template DocumentLibrary -Url $Title.Replace(" ", "") -Description $Description
        Write-Host "  Documentbibliotheek '$Title' succesvol aangemaakt." -ForegroundColor Green
        
        # Apply command bar formatting
        Write-Host "  Toepassen van command bar formatting..." -ForegroundColor Cyan
        Set-PnPView -List $Title -Identity "All Documents" -Values @{
            "CustomFormatter" = $JsonFormat
        }
        
        # Add to Quick Launch (left navigation)
        Write-Host "  Toevoegen aan Quick Launch navigatie..." -ForegroundColor Cyan
        $listUrl = "$($SiteUrl)/Lists/$($Title.Replace(' ', ''))"
        Add-PnPNavigationNode -Location QuickLaunch -Title $Title -Url $listUrl
        
        Write-Host "  Setup voor '$Title' voltooid." -ForegroundColor Green
        return $newList
        
    }
    catch {
        Write-Error "Fout bij het aanmaken van documentbibliotheek '$Title': $($_.Exception.Message)"
        return $null
    }
}

# Main execution
try {
    Write-Host "=== SharePoint Document Libraries Setup Script ===" -ForegroundColor Magenta
    Write-Host "Site URL: $SiteUrl" -ForegroundColor White
    Write-Host "Aantal te maken libraries: $($Werkmappen.Count)" -ForegroundColor White
    Write-Host ""
    
    # Connect to SharePoint
    Write-Host "Verbinding maken met SharePoint..." -ForegroundColor Yellow
    Connect-PnPOnline -Url $SiteUrl -Interactive
    Write-Host "Succesvol verbonden met SharePoint." -ForegroundColor Green
    Write-Host ""
    
    # Create each document library
    $successCount = 0
    $errorCount = 0
    
    foreach ($werkmap in $Werkmappen) {
        $result = New-CustomDocumentLibrary -Title $werkmap.Title -Description $werkmap.Desc -JsonFormat $CommandBarJson
        
        if ($result) {
            $successCount++
        } else {
            $errorCount++
        }
        
        # Small delay to prevent throttling
        Start-Sleep -Seconds 1
        Write-Host ""
    }
    
    # Summary
    Write-Host "=== SAMENVATTING ===" -ForegroundColor Magenta
    Write-Host "Succesvol aangemaakt: $successCount documentbibliotheken" -ForegroundColor Green
    Write-Host "Fouten: $errorCount" -ForegroundColor Red
    Write-Host "Totaal: $($Werkmappen.Count)" -ForegroundColor White
    
    if ($successCount -gt 0) {
        Write-Host "`nDe volgende documentbibliotheken zijn aangemaakt:" -ForegroundColor Green
        foreach ($werkmap in $Werkmappen) {
            Write-Host "  - $($werkmap.Title)" -ForegroundColor White
        }
        
        Write-Host "`nElke bibliotheek heeft:" -ForegroundColor Yellow
        Write-Host "  ✓ Custom command bar formatting" -ForegroundColor White
        Write-Host "  ✓ Snelkoppeling in de linkernavigatie" -ForegroundColor White
        Write-Host "  ✓ Aangepaste beschrijving" -ForegroundColor White
    }
    
}
catch {
    Write-Error "Kritieke fout tijdens uitvoering: $($_.Exception.Message)"
    Write-Host "Stack trace:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
}
finally {
    # Disconnect from SharePoint
    try {
        Disconnect-PnPOnline
        Write-Host "`nVerbinding met SharePoint gesloten." -ForegroundColor Yellow
    }
    catch {
        # Silent disconnect error
    }
}

Write-Host "`nScript voltooid. Druk op een toets om te sluiten..." -ForegroundColor Cyan
$host.UI.RawUI.ReadKey() | Out-Null
