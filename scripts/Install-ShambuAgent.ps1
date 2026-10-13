# Install only Shambu's optional read-only host companion. Ollama is not changed.
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$AgentExe = (Join-Path (Split-Path -Parent $PSScriptRoot) 'app\target\release\shambu-agent.exe'),
    [string]$TaskName = 'Shambu-Agent',
    [string]$OllamaUrl
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ShambuAgent.Common.ps1')
Assert-ShambuTaskName -TaskName $TaskName
$paths = Get-ShambuAgentPaths
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator using the same Windows account that runs Shambu.'
}
if (Test-ShambuAppDataRedirected) {
    throw 'Open Windows PowerShell directly from the Start menu as Administrator, then run this installer there. This packaged terminal redirects app-data files into a private container that startup tasks cannot see.'
}
$source = (Get-Item -LiteralPath $AgentExe -ErrorAction Stop).FullName
if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or [IO.Path]::GetExtension($source) -ne '.exe') {
    throw 'Build the release companion first or supply the path to shambu-agent.exe.'
}
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    throw 'This task name already exists. Inspect it or uninstall the managed task before reinstalling.'
}
if (Get-ShambuAgentListener) {
    throw 'Loopback port 11435 is occupied. Stop the standalone companion before installing startup.'
}
if (-not $PSCmdlet.ShouldProcess($TaskName, 'Install the read-only Shambu companion with startup and recurring recovery')) { return }

# Initialization protects its app-data directory and never prints the key.
if (Test-Path -LiteralPath $paths.Config) {
    $config = Read-ShambuAgentConfig -Path $paths.Config
    if ($OllamaUrl -and $config.endpoint.TrimEnd('/') -ne $OllamaUrl.TrimEnd('/')) {
        throw 'The saved companion uses another Ollama endpoint. Update its private config before reinstalling.'
    }
} else {
    $arguments = @('--init')
    if ($OllamaUrl) { $arguments += @('--ollama-url', $OllamaUrl) }
    & $source @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Private companion initialization failed.' }
    $config = Read-ShambuAgentConfig -Path $paths.Config
}
New-Item -ItemType Directory -Path $paths.BinaryDirectory -Force | Out-Null
if ($source -ne $paths.Binary) { Copy-Item -LiteralPath $source -Destination $paths.Binary -Force }
$action = New-ScheduledTaskAction -Execute $paths.Binary -WorkingDirectory $paths.BinaryDirectory
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType S4U -RunLevel Limited
$boot = New-ScheduledTaskTrigger -AtStartup
$boot.Delay = 'PT60S'
$recovery = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
$registered = $false
try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($boot, $recovery) -Principal $taskPrincipal -Settings $taskSettings -Description 'Shambu: read-only GPU host status on loopback port 11435. Private networking is managed separately by Tailscale.' | Out-Null
    $registered = $true
    $startedAt = Get-Date
    Start-ScheduledTask -TaskName $TaskName
    $deadline = (Get-Date).AddSeconds(45)
    $ready = $false
    $headers = @{ Authorization = 'Bearer ' + $config.pairingKey }
    do {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:11435/health' -Headers $headers -TimeoutSec 4
            $ids = @($health.snapshot.checks | ForEach-Object { $_.id } | Sort-Object)
            $expected = @('forwarding', 'gpu', 'models', 'ollama', 'tailscale')
            $ready = $health.protocolVersion -eq 1 -and $health.sampleAgeMs -le 65000 -and
                $health.snapshot.mode -eq 'host' -and $health.snapshot.hostDetails -eq 'local' -and
                $ids.Count -eq 5 -and -not (Compare-Object $expected $ids)
            if ($ready) { break }
        } catch { }
        $currentTask = Get-ScheduledTask -TaskName $TaskName
        if ($currentTask.State -eq 'Ready') {
            $info = Get-ScheduledTaskInfo -TaskName $TaskName
            if ($info.LastRunTime -ge $startedAt.AddSeconds(-2)) {
                $code = '0x{0:X8}' -f $info.LastTaskResult
                throw "The companion task exited before providing a fresh status (task result $code)."
            }
        }
    } while ((Get-Date) -lt $deadline)
    if (-not $ready) { throw 'The companion did not return an authenticated, fresh host status in time.' }
    Write-Output 'Installed the Shambu companion. Its private pairing key was preserved and not printed.'
    Write-Output 'Add the private Tailscale forward for port 11435, then copy the key through Shambu to link other devices.'
    Write-Output 'A full PC reboot has not been tested by this script.'
} catch {
    $failure = $_
    $cleanupFailed = $false
    if ($registered) {
        foreach ($cleanup in @(
            { Disable-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null },
            { Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop },
            { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop }
        )) {
            try { & $cleanup } catch { $cleanupFailed = $true }
        }
    }
    if ($cleanupFailed) { Write-Warning 'Task cleanup was incomplete. Inspect the Shambu task before retrying.' }
    throw $failure
} finally {
    if ($headers) { $headers.Clear() }
    $config = $null
}