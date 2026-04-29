$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$patterns = @(
  "from\s+['\"]node:",
  "require\(\s*['\"]node:"
)

$files = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.mjs,*.cjs,*.jsx,*.ts,*.tsx |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.git\\' }

$matches = @()
foreach ($file in $files) {
  $results = Select-String -Path $file.FullName -Pattern $patterns -AllMatches
  if ($results) {
    $matches += $results
  }
}

if ($matches.Count -gt 0) {
  Write-Host "Found Node-only imports/requires that will break in browser builds:" -ForegroundColor Red
  foreach ($match in $matches) {
    $relativePath = $match.Path.Substring($root.Length + 1)
    Write-Host "$relativePath:$($match.LineNumber): $($match.Line.Trim())" -ForegroundColor Yellow
  }
  exit 1
}

Write-Host "No Node-only imports found in browser code files." -ForegroundColor Green
exit 0
