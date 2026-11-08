<#
.SYNOPSIS
  The daily backup of what lives outside git (docs/OPERATIONS.md, "What lives outside git") to K:\COR.

.DESCRIPTION
  Standalone: reads the publishing ledgers as JSON files and runs Windows' tar.exe. No npm verb, nothing imported
  from src/, no key in automation.json. The include list is generated on every run: the fixed paths of the runbook's
  table, every run/ and history/ folder that exists, and the release build of every output whose ledger holds a
  `published` event, checked against the sha the upload bound (a missing one fails the run). The repository is only
  read: the list, the log and the archive are written at the destination. The archive is built as <name>.part and
  renamed only after tar exited 0 and the file is at least as large as the files it holds, so the destination holds a
  complete archive under its final name or nothing under it; its SHA-256 is written beside it. Any failure exits 1
  (Task Scheduler's Last Run Result) and logs one line (names, sizes and outcomes only, never a file's contents).
  The archive is not encrypted: it holds .env, the OAuth client file and the mail records, so the destination must be
  a private folder (the runbook says what was established about K:\COR). Dated archives are never pruned here.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup.ps1
#>
param(
  [string]$Destination = 'K:\COR',
  [string]$Repo = '', # default: the folder above scripts/ ($PSScriptRoot is not set in a param default)
  [string]$Tar = (Join-Path $env:SystemRoot 'System32\tar.exe')
)
$ErrorActionPreference = 'Stop'
$start = Get-Date
if (-not $Repo) { $Repo = Split-Path -Parent $PSScriptRoot }
$Repo = (Resolve-Path $Repo).Path.TrimEnd('\')
$name = 'video-knowledge-' + $start.ToString('yyyy-MM-dd') + '.tar'
# a second run on the same day gets its own name (the time); an existing archive is never overwritten
if (Test-Path -LiteralPath (Join-Path $Destination $name)) { $name = 'video-knowledge-' + $start.ToString('yyyy-MM-dd-HHmmss') + '.tar' }
$final = Join-Path $Destination $name
$part = "$final.part"
$list = "$final.paths.txt"
$log = Join-Path $Destination 'backup.log'

function Write-Log([string]$outcome, [string]$detail) {
  Add-Content -Encoding utf8 -Path $log -Value ("{0} {1} {2}: {3}" -f (Get-Date).ToString('s'), $name, $outcome, $detail)
}
function Fail([string]$why) {
  Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $part
  if (Test-Path -LiteralPath $Destination) { Write-Log 'failed' $why }
  Write-Host "backup failed: $why"
  exit 1
}
function Rel([string]$full) { return $full.Substring($Repo.Length + 1).Replace('\', '/') }

try {
  if (-not (Test-Path -LiteralPath $Tar)) { Fail "tar not found: $Tar" }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  if (Test-Path -LiteralPath $final) { Fail "$name already exists (nothing is overwritten)" }

  # 1. the include list: the fixed paths (each must exist), the folders that exist, the published finals
  $paths = New-Object System.Collections.Generic.List[string]
  foreach ($p in @('.env', '.secrets', '.automation', '.superpowers', 'docs\superpowers', 'readiness.json', 'automation.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $Repo $p))) { Fail "fixed path missing: $p" }
    $paths.Add($p.Replace('\', '/'))
  }
  foreach ($pattern in @('topics\*\scripts\*\run', 'topics\*\scripts\*\shorts\*\run', 'topics\*\work\run', 'topics\*\history')) {
    foreach ($d in @(Get-Item -Path (Join-Path $Repo $pattern) -Force -ErrorAction SilentlyContinue)) {
      if ($d -and $d.PSIsContainer) { $paths.Add((Rel $d.FullName)) }
    }
  }
  $finals = 0
  foreach ($ledger in @(Get-Item -Path (Join-Path $Repo 'topics\*\scripts\*\publish.json') -Force -ErrorAction SilentlyContinue)) {
    if (-not $ledger) { continue }
    try { $l = Get-Content -Raw -LiteralPath $ledger.FullName | ConvertFrom-Json } catch { Fail "ledger does not parse: $(Rel $ledger.FullName)" }
    foreach ($prop in $l.outputs.PSObject.Properties) {
      $o = $prop.Value
      $published = @($o.events | Where-Object { $_.type -eq 'published' })
      if ($published.Count -eq 0) { continue }
      $upload = @($o.events | Where-Object { $_.type -eq 'uploaded' -and $_.build }) | Select-Object -Last 1
      if (-not $upload) { Fail "published output $($prop.Name) of $(Rel $ledger.FullName) has no uploaded build" }
      $folder = if ($o.source) { Join-Path $Repo $o.source } else { Split-Path -Parent $ledger.FullName }
      $review = Join-Path $folder 'video\review'
      $mp4s = @(Get-ChildItem -LiteralPath $review -Filter *.mp4 -File -Force -ErrorAction SilentlyContinue)
      # the build the approval and the publication bind: the repo's sha() is the first 10 hex of SHA-1
      $match = $mp4s | Where-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA1).Hash.ToLower().Substring(0, 10) -eq $upload.build }
      if (-not $match) { Fail "published final missing: output $($prop.Name) of $(Rel $ledger.FullName), build $($upload.build), under $(Rel $review)" }
      foreach ($m in @($match)) { $paths.Add((Rel $m.FullName)); $finals++ }
    }
  }
  $paths = @($paths | Sort-Object -Unique)
  if ($paths.Count -eq 0) { Fail 'empty include list' }
  Set-Content -Encoding ascii -LiteralPath $list -Value $paths
  $files = @($paths | ForEach-Object { Get-ChildItem -LiteralPath (Join-Path $Repo $_) -Recurse -File -Force })
  $bytes = ($files | Measure-Object -Property Length -Sum).Sum
  Write-Host ("include list: {0} entries, {1} files, {2:N0} bytes, {3} published finals" -f $paths.Count, $files.Count, $bytes, $finals)

  # 2. the archive, then the checks, then the rename
  Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $part
  & $Tar -cf $part -C $Repo -T $list
  $tarExit = $LASTEXITCODE
  if ($tarExit -ne 0) { Fail "tar exited $tarExit (a listed path unreadable or gone)" }
  if (-not (Test-Path -LiteralPath $part)) { Fail 'no archive written' }
  $size = (Get-Item -LiteralPath $part).Length
  if ($size -lt $bytes) { Fail ("archive smaller than its files ({0:N0} < {1:N0} bytes): incomplete" -f $size, $bytes) }
  Move-Item -LiteralPath $part -Destination $final
  (Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash.ToLower() | Set-Content -Encoding ascii -LiteralPath "$final.sha256"
  $seconds = [int]((Get-Date) - $start).TotalSeconds
  Write-Log 'ok' ("{0:N0} bytes, {1} files, {2} published finals, {3} s" -f $size, $files.Count, $finals, $seconds)
  Write-Host ("wrote {0} ({1:N0} bytes, {2} files) in {3} s" -f $final, $size, $files.Count, $seconds)
  exit 0
} catch {
  Fail ("unexpected: " + $_.Exception.Message)
}
