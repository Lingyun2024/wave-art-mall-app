$lines = [System.IO.File]::ReadAllLines('G:\草稿\待辦事項\APP_!\pages\mars-healing.html', [System.Text.Encoding]::UTF8)
for ($i = 144; $i -le 147; $i++) {
    Write-Output "LINE $i`: $($lines[$i])"
}
