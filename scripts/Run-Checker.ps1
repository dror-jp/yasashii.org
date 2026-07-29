# Run-Checker.ps1 — runs the やさしい日本語 machine checker over every document.
# Informational: the checker highlights sentences to re-check; it is NOT pass/fail
# (the national guideline deliberately sets no numeric thresholds).
# Fails only if the front-matter scores drifted from the actual text — that means
# a document was edited without re-running the checker.
#
# Usage: pwsh scripts/Run-Checker.ps1   (run `npm ci` in kit/checker first)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$checker = Join-Path $root "kit\checker"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "yasashii-checker-body.txt"
$drifted = @()

Push-Location $checker
try {
    foreach ($f in Get-ChildItem "$root\content\bunsho" -Recurse -Filter index.md) {
        if ($f.Directory.Name -eq "bunsho") { continue }  # section _index
        $raw = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
        $parts = $raw -split "(?m)^---\s*$", 3
        if ($parts.Count -lt 3) { continue }
        [System.IO.File]::WriteAllText($tmp, $parts[2], (New-Object System.Text.UTF8Encoding($false)))
        $j = node checker.mjs $tmp | Out-String | ConvertFrom-Json
        $doc = $f.Directory.Name
        Write-Output ("{0}: avg={1} kango={2}% warnings={3}" -f $doc, $j.avg_sentence_chars, $j.kango_rate, $j.warning_count)

        # Compare with front matter scores (drift detection)
        if ($parts[1] -match 'warning_count:\s*(\d+)') {
            $declared = [int]$Matches[1]
            if ($declared -ne [int]$j.warning_count) {
                $drifted += "$doc (front matter: $declared, actual: $($j.warning_count))"
            }
        }
    }
} finally {
    Pop-Location
}

Write-Output ""
if ($drifted.Count -gt 0) {
    Write-Output "SCORE DRIFT — re-run the checker and update front matter scores for:"
    $drifted | ForEach-Object { Write-Output "  - $_" }
    exit 1
}
Write-Output "All front-matter scores match the checker output."
exit 0
