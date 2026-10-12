# Shared configuration and task identity checks. Dot-source this file.
function Get-ConnextConfig {
    param([Parameter(Mandatory)][string]$Path)
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    $raw = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
    foreach ($field in @('TaskName','OllamaExe','ModelsDirectory','Port','ContextLength','DiscoveryTimeoutSeconds')) {
        if ($null -eq $raw.$field) { throw "Configuration field '$field' is required." }
    }
    foreach ($field in @('TaskName','OllamaExe','ModelsDirectory')) {
        if ($raw.$field -isnot [string] -or [string]::IsNullOrWhiteSpace($raw.$field)) { throw "$field must be a nonempty string." }
    }
    if ($raw.TaskName -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') { throw 'TaskName must be a simple task name, without a folder path.' }
    foreach ($field in @('Port','ContextLength','DiscoveryTimeoutSeconds')) {
        if ($raw.$field -isnot [int] -and $raw.$field -isnot [long]) { throw "$field must be an integer." }
    }
    if ($raw.Port -lt 1024 -or $raw.Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
    if ($raw.ContextLength -lt 512 -or $raw.ContextLength -gt 1048576) { throw 'ContextLength is out of range.' }
    if ($raw.DiscoveryTimeoutSeconds -lt 10 -or $raw.DiscoveryTimeoutSeconds -gt 300) { throw 'DiscoveryTimeoutSeconds must be between 10 and 300.' }
    $exe = [Environment]::ExpandEnvironmentVariables([string]$raw.OllamaExe)
    $models = [Environment]::ExpandEnvironmentVariables([string]$raw.ModelsDirectory)
    foreach ($value in @($exe,$models)) {
        if ($value -notmatch '^[A-Za-z]:[\\/]' -or $value.Contains('"') -or $value.Contains('%')) {
            throw 'Executable and model paths must expand to absolute Windows paths.'
        }
        if ($value.StartsWith('\\')) { throw 'Use local disk paths, not a network share, for noninteractive startup.' }
    }
    [pscustomobject]@{
        TaskName = [string]$raw.TaskName
        OllamaExe = [IO.Path]::GetFullPath($exe)
        ModelsDirectory = [IO.Path]::GetFullPath($models)
        Port = [int]$raw.Port
        ContextLength = [int]$raw.ContextLength
        DiscoveryTimeoutSeconds = [int]$raw.DiscoveryTimeoutSeconds
        ConfigPath = $resolved
        RuntimeDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) '.local'
    }
}
function Get-ConnextTaskAction {
    param([Parameter(Mandatory)]$Config)
    $launcher = Join-Path $PSScriptRoot 'Start-Ollama.ps1'
    $powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' +
        $launcher + '" -ConfigPath "' + $Config.ConfigPath + '"'
    [pscustomobject]@{ Execute = $powershellExe; Arguments = $arguments }
}
function Assert-ConnextTask {
    param([Parameter(Mandatory)]$Task,[Parameter(Mandatory)]$Config)
    $expected = Get-ConnextTaskAction -Config $Config
    if ($Task.Actions.Count -ne 1 -or $Task.Actions[0].Execute -ne $expected.Execute -or
        $Task.Actions[0].Arguments -ne $expected.Arguments) {
        throw 'The existing task does not belong to this checkout and configuration.'
    }
}
function Get-ConnextListener {
    param([Parameter(Mandatory)][int]$Port)
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -in @('127.0.0.1','0.0.0.0','::','::1') }
}
