# Interrupts the managed server. Do not run while any client or GPU job is active.
param(
    [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.local.json'),
    [switch]$StopServer
)
$ErrorActionPreference = 'Stop'
if (-not $StopServer) { throw 'This test stops Ollama. Run with -StopServer only during a maintenance window.' }
. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Get-ConnextConfig -Path $ConfigPath
$task = Get-ScheduledTask -TaskName $config.TaskName -ErrorAction Stop
Assert-ConnextTask -Task $task -Config $config
if ($task.State -ne 'Running') { throw 'The task must be running before testing recovery.' }
if (-not ($task.Triggers | Where-Object { $_.Repetition.Interval -eq 'PT1M' -and -not $_.Repetition.Duration })) {
    throw 'The indefinite one-minute recovery trigger is missing.'
}
$base = "http://127.0.0.1:$($config.Port)"
$models = (Invoke-RestMethod -Uri "$base/api/ps" -TimeoutSec 5).models
if (@($models).Count -gt 0) { throw 'A model is loaded. Finish active work and unload cached models before testing.' }
$statePath = Join-Path $config.RuntimeDirectory "server-$($config.Port).json"
$resultPath = Join-Path $config.RuntimeDirectory 'recovery-test.json'
$before = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$process = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $before.ProcessId)
if (-not $process -or $process.Name -ne 'ollama.exe' -or
    [Math]::Abs(($process.CreationDate.ToUniversalTime() - ([datetime]$before.StartedUtc).ToUniversalTime()).TotalSeconds) -ge 1) {
    throw 'The recorded server process no longer matches. Nothing was stopped.'
}
$result = [ordered]@{ State = 'Testing'; PreviousProcessId = $before.ProcessId; Error = $null }
$stopped = $false
try {
    Stop-ScheduledTask -TaskName $config.TaskName -ErrorAction Stop
    $stopped = $true
    $started = Get-Date
    $result | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
    $deadline = $started.AddSeconds(90 + $config.DiscoveryTimeoutSeconds)
    do {
        Start-Sleep -Seconds 2
        try { $after = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } catch { continue }
        if ($after.State -eq 'Running' -and $after.CudaDetected -and
            $after.ProcessId -ne $before.ProcessId -and
            ([datetime]$after.StartedUtc).ToUniversalTime() -gt $started.ToUniversalTime()) {
            $version = Invoke-RestMethod -Uri "$base/api/version" -TimeoutSec 5
            $result.State = 'Passed'
            $result.NewProcessId = $after.ProcessId
            $result.Version = $version.version
            $result.RecoverySeconds = [Math]::Round(((Get-Date) - $started).TotalSeconds,1)
            $result | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
            $result | ConvertTo-Json
            return
        }
    } while ((Get-Date) -lt $deadline)
    throw 'The recurring trigger did not restore CUDA service before the deadline.'
} catch {
    $result.State = 'Failed'
    $result.Error = $_.Exception.Message
    $result | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
    if ($stopped) { Start-ScheduledTask -TaskName $config.TaskName -ErrorAction SilentlyContinue }
    throw
}
