# Register background startup for the current Windows account.
# Elevate the same account that owns the Ollama installation.
[CmdletBinding(SupportsShouldProcess)]
param([string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.local.json'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Get-ConnextConfig -Path $ConfigPath
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator under the account that installed Ollama.'
}
if (-not (Test-Path -LiteralPath $config.OllamaExe -PathType Leaf)) { throw 'The configured Ollama executable does not exist.' }
if (-not (Test-Path -LiteralPath (Join-Path $config.ModelsDirectory 'manifests') -PathType Container)) {
    throw 'The model folder has no manifests directory. Check the folder used by your existing Ollama installation.'
}
if (Get-ScheduledTask -TaskName $config.TaskName -ErrorAction SilentlyContinue) {
    throw 'This task name already exists. Inspect it or uninstall this checkout before reinstalling.'
}
if (Get-ConnextListener -Port $config.Port) {
    throw 'The local port is occupied. Quit the Ollama tray app and stop any existing server before installing.'
}
if (-not $PSCmdlet.ShouldProcess($config.TaskName,'Register and start Ollama before sign-in, with a recurring recovery trigger')) { return }

New-Item -ItemType Directory -Path $config.RuntimeDirectory -Force | Out-Null
$statePath = Join-Path $config.RuntimeDirectory "server-$($config.Port).json"
$statusPath = Join-Path $config.RuntimeDirectory 'installation.json'
$actionSpec = Get-ConnextTaskAction -Config $config
$action = New-ScheduledTaskAction -Execute $actionSpec.Execute -Argument $actionSpec.Arguments -WorkingDirectory $PSScriptRoot
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType S4U -RunLevel Limited
$boot = New-ScheduledTaskTrigger -AtStartup
$boot.Delay = 'PT60S'
$recovery = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
$registered = $false
try {
    @{ State = 'Pending' } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Register-ScheduledTask -TaskName $config.TaskName -Action $action -Trigger @($boot,$recovery) -Principal $taskPrincipal -Settings $settings -Description 'Connext: local Ollama with CUDA checks and recurring recovery. Private networking is configured separately with Tailscale.' | Out-Null
    $registered = $true
    Start-ScheduledTask -TaskName $config.TaskName
    $deadline = (Get-Date).AddSeconds($config.DiscoveryTimeoutSeconds + 30)
    $ready = $false
    do {
        Start-Sleep -Milliseconds 500
        try { $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } catch { continue }
        if ($state.State -eq 'Failed') { throw $state.Error }
        if ($state.State -eq 'Running' -and $state.CudaDetected) {
            $version = Invoke-RestMethod -Uri "http://127.0.0.1:$($config.Port)/api/version" -TimeoutSec 5
            $ready = [bool]$version.version
            if ($ready) { break }
        }
    } while ((Get-Date) -lt $deadline)
    if (-not $ready) { throw 'Background startup did not finish with CUDA. See the local logs.' }
    @{
        State = 'Installed'; TaskName = $config.TaskName; Account = $identity.Name
        InstalledUtc = [datetime]::UtcNow.ToString('o'); CudaDetected = $true
        InferenceVerified = $false; FullRebootVerified = $false
    } | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
    Write-Output "Installed $($config.TaskName). CUDA is available. Run Test-Inference.ps1 when the GPU is free."
} catch {
    $failure = $_
    $cleanupErrors = @()
    if ($registered) {
        # Disable the recurring trigger before stopping the task to prevent a race.
        foreach ($cleanup in @(
            { Disable-ScheduledTask -TaskName $config.TaskName -ErrorAction Stop | Out-Null },
            { Stop-ScheduledTask -TaskName $config.TaskName -ErrorAction Stop },
            { Unregister-ScheduledTask -TaskName $config.TaskName -Confirm:$false -ErrorAction Stop }
        )) {
            try { & $cleanup } catch { $cleanupErrors += $_.Exception.Message }
        }
    }
    if ($cleanupErrors.Count) { Write-Warning 'Task cleanup was incomplete. Inspect the task and the local installation status before retrying.' }
    @{
        State = 'Failed'; Error = $failure.Exception.Message; CleanupErrors = $cleanupErrors
    } | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
    throw $failure
}
