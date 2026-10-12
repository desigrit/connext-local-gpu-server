# Offline checks only: no GPU requests, task changes, or network connections.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '[\\/](\.git|\.local)[\\/]' -and $_.Name -ne 'config.local.json' })
foreach ($file in $files | Where-Object { $_.Extension -eq '.ps1' }) {
    $tokens = $null; $errors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)
    if ($errors) { throw "PowerShell syntax error in $($file.Name): $($errors[0].Message)" }
}
foreach ($file in $files | Where-Object { $_.Extension -in @('.md','.ps1','.json') }) {
    $text = Get-Content -LiteralPath $file.FullName -Raw
    if ($text.Contains([string][char]0x2014)) { throw "Disallowed punctuation in $($file.Name)." }
}
foreach ($file in $files | Where-Object { $_.Extension -eq '.md' }) {
    $text = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($match in [regex]::Matches($text,'\[[^\]]+\]\(([^)\s]+)\)')) {
        $target = $match.Groups[1].Value
        if ($target -match '^(https?://|#)') { continue }
        $target = ($target -split '#',2)[0]
        if (-not (Test-Path -LiteralPath (Join-Path $file.DirectoryName $target))) {
            throw "Broken local documentation link in $($file.Name): $target"
        }
    }
}
. (Join-Path $root 'scripts\Common.ps1')
$config = Get-ConnextConfig -Path (Join-Path $root 'config.example.json')
if ($config.Port -ne 11434 -or $config.TaskName -ne 'Connext-Ollama') { throw 'Unexpected example configuration.' }
if ($config.RuntimeDirectory -ne (Join-Path $root '.local')) { throw 'Runtime data must remain in the ignored local directory.' }
if ($config.OllamaExe.Contains('%') -or $config.ModelsDirectory.Contains('%')) { throw 'Environment placeholders were not expanded.' }

$tempFile = Join-Path ([IO.Path]::GetTempPath()) ('connext-validation-' + [guid]::NewGuid().ToString('N') + '.json')
try {
    foreach ($case in @(
        @{ Field = 'Port'; Value = 80 },
        @{ Field = 'TaskName'; Value = $true },
        @{ Field = 'ModelsDirectory'; Value = 'C:relative-models' },
        @{ Field = 'Port'; Value = '11434' },
        @{ Field = 'TaskName'; Value = '..\foreign-task' },
        @{ Field = 'ModelsDirectory'; Value = '\\server\share' },
        @{ Field = 'DiscoveryTimeoutSeconds'; Value = 0 }
    )) {
        $bad = Get-Content -LiteralPath (Join-Path $root 'config.example.json') -Raw | ConvertFrom-Json
        $bad.($case.Field) = $case.Value
        $bad | ConvertTo-Json | Set-Content -LiteralPath $tempFile -Encoding UTF8
        $rejected = $false
        try { $null = Get-ConnextConfig -Path $tempFile } catch { $rejected = $true }
        if (-not $rejected) { throw "Invalid configuration accepted: $($case.Field)." }
    }
} finally {
    if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile }
}
$tokens = $null; $errors = $null
$launcherAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'scripts\Start-Ollama.ps1'),[ref]$tokens,[ref]$errors)
$nativeSource = $launcherAst.Find({
    param($node)
    $node -is [System.Management.Automation.Language.StringConstantExpressionAst] -and
        $node.Value.Contains('public sealed class ConnextProcessJob')
},$true)
if (-not $nativeSource) { throw 'Windows process helper is missing.' }
Add-Type -TypeDefinition $nativeSource.Value
$emptyJob = New-Object ConnextProcessJob
$emptyJob.Dispose()
Write-Output 'Passed: script syntax, documentation links, punctuation, portable defaults, invalid configuration checks, and Windows process-helper initialization.'
