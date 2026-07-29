# Check-Links.ps1 — verifies every external URL published on the site.
# The freshness promise ("確認日") depends on this running weekly.
# Uses a browser User-Agent: some sites return 403 to non-browser agents.
#
# Usage: pwsh scripts/Check-Links.ps1   (exit code 1 if any link is broken)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path $PSScriptRoot -Parent
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# Collect URLs from content front matter and static text files
$files = @(Get-ChildItem "$root\content" -Recurse -Filter *.md) + @(Get-ChildItem "$root\static" -Filter *.txt)
$urls = foreach ($f in $files) {
    [regex]::Matches((Get-Content $f.FullName -Raw), 'https?://[^\s"''<>\)\]]+') | ForEach-Object { $_.Value.TrimEnd('.', ',') }
}
$urls = $urls | Where-Object {
    $_ -notmatch '^https://yasashii\.org' -and            # self
    $_ -notmatch 'creativecommons\.org'                   # license boilerplate
} | Sort-Object -Unique

# Sites that block datacenter IPs (403 from CI runners, fine from residential
# connections). A 403 from these is a warning, not a failure — but any other
# error still fails, so we don't go blind to real link rot there.
$botBlockedHosts = @("www.npmjs.com")

Write-Output "Checking $($urls.Count) unique external URLs..."
$failed = @()
$warned = @()

foreach ($url in $urls) {
    $ok = $false
    $status = 0
    foreach ($attempt in 1..2) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UserAgent $ua -Method Get -TimeoutSec 30 -UseBasicParsing -MaximumRedirection 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) { $ok = $true; break }
        } catch {
            $err = $_.Exception.Message
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
            if ($attempt -lt 2) { Start-Sleep -Seconds 3 }
        }
    }
    $host403 = ([uri]$url).Host
    if ($ok) {
        Write-Output "  OK   $url"
    } elseif ($status -eq 403 -and $botBlockedHosts -contains $host403) {
        Write-Output "  WARN $url  (403 from a datacenter IP - known bot-blocker, verify from a residential connection)"
        $warned += $url
    } else {
        Write-Output "  FAIL $url  ($err)"
        $failed += $url
    }
}

Write-Output ""
if ($warned.Count -gt 0) {
    Write-Output "WARNINGS (bot-blocked hosts, check manually): $($warned.Count)"
}
if ($failed.Count -gt 0) {
    Write-Output "BROKEN LINKS: $($failed.Count) of $($urls.Count)"
    $failed | ForEach-Object { Write-Output "  - $_" }
    Write-Output "Fix or mark these before the next deploy. Do not delete silently — update the verified date when re-verified."
    exit 1
}
Write-Output "All $($urls.Count) links OK."
exit 0
