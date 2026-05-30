$file = "c:\Users\joche\trainer-app\src\App.tsx"
$content = [System.IO.File]::ReadAllText($file)

# --- 1. app-root div style: change to dark #0f0c29 background ---
$old1 = 'style={{ maxWidth: 720, flex: 1, margin: "0 auto", padding: 16, paddingTop: ''calc(20px + var(--safe-top, 0px))'', paddingBottom: ''calc(16px + var(--safe-bottom, 0px))'', borderRadius: 16, background: "linear-gradient(180deg,#dfe9ff,#eaf2ff)", boxShadow: "0 4px 24px #0001", fontFamily: ''Inter, system-ui, sans-serif'', position: ''relative'', display: ''flex'', flexDirection: ''column'', alignItems: ''center'', overflow: ''hidden'' }}'
$new1 = 'style={{ maxWidth: 720, flex: 1, margin: "0 auto", padding: 0, background: "#0f0c29", fontFamily: ''Inter, system-ui, sans-serif'', position: ''relative'', display: ''flex'', flexDirection: ''column'', alignItems: ''stretch'', overflow: ''hidden'' }}'
if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "1 OK: app-root style updated"
} else { Write-Host "1 FAIL: app-root style not found" }

# --- 2. Add c3-hero wrapper: insert after <div className="top-sticky"> ---
$crlf = "`r`n"
$tab = "`t"
$old2 = "<div className=`"top-sticky`">$crlf$($tab*9)<div className=`"topbar`">"
$new2 = "<div className=`"top-sticky`">$crlf$($tab*9)<div className=`"c3-hero`">$crlf$($tab*9)<div className=`"topbar`">"
if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    Write-Host "2 OK: c3-hero wrapper added"
} else { Write-Host "2 FAIL: top-sticky/topbar not found" }

# --- 2b. Replace status-card IIFE with c3 speed section + cards-row ---
$statusCardPattern = '\{/\* Status card \*/\}[\s\S]*?\}\)\(\)\}'
$newStatusContent = [System.IO.File]::ReadAllText("c:\Users\joche\trainer-app\scripts\c3-new-content.txt")
# Normalize line endings to match the target file (CRLF)
$newStatusContent = $newStatusContent -replace "`r`n", "`n" -replace "`n", "`r`n"
$content = [regex]::Replace($content, $statusCardPattern, $newStatusContent.TrimEnd())
Write-Host "2b OK: status-card replaced with c3 speed + cards"

# --- 3. Replace actions-under-card class ---
$old3 = 'className="actions-row actions-under-card"'
$new3 = 'className="actions-row"'
if ($content.Contains($old3)) {
    $content = $content.Replace($old3, $new3)
    Write-Host "3 OK: actions-under-card removed"
} else { Write-Host "3 FAIL: actions-under-card not found" }

# --- 4. Replace BT button inline style with className + shorter style ---
# Use regex to find and replace the large style block
$btStylePattern = '(\s+title=\{btStatus === ''connected''\s*\?.+?''Verbinden met loopband''\})\s+style=\{\{[\s\S]*?gap: 2,\s*\}\}'
$btStyleReplacement = '$1' + "`r`n" + "						className=`"btn-bt`"`r`n" + `
"						style={{`r`n" + `
"							background: btStatus === 'connected' ? '#28a745' : btStatus === 'connecting' ? '#764ba2' : btStatus === 'error' ? '#dc3545' : '#1a1835',`r`n" + `
"							cursor: btStatus === 'connecting' ? 'default' : 'pointer',`r`n" + `
"						}}"
$content = [regex]::Replace($content, $btStylePattern, $btStyleReplacement)
Write-Host "4 OK: BT button style updated"

# --- 5. Update BT label from 'Loopband' to 'BT' ---
$old5 = "btStatus === 'error' ? 'Fout' : 'Loopband'}"
$new5 = "btStatus === 'error' ? 'Fout' : 'BT'}"
if ($content.Contains($old5)) {
    $content = $content.Replace($old5, $new5)
    Write-Host "5 OK: BT label updated"
} else { Write-Host "5 FAIL: BT label not found" }

# Save file
[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "File saved."
