# Remove only this account's managed companion task. Preserve its private key and Ollama.
[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param([string]$TaskName = 'Shambu-Agent')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ShambuAgent.Common.ps1')
Assert-ShambuTaskName -TaskName $TaskName
$paths = Get-ShambuAgentPaths
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
Assert-ShambuAgentTask -Task $task -Paths $paths
if (-not $PSCmdlet.ShouldProcess($TaskName, 'Disable recovery, stop the read-only companion, and remove its startup task')) { return }
Disable-ScheduledTask -TaskName $TaskName | Out-Null
Stop-ScheduledTask -TaskName $TaskName
$deadline = (Get-Date).AddSeconds(15)
do {
    if (-not (Get-ShambuAgentListener)) { break }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)
if (Get-ShambuAgentListener) {
    throw 'Port 11435 is still occupied. The managed task is disabled but retained for inspection.'
}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Output 'Removed the Shambu companion task. Ollama, the private pairing key, and installed binaries were preserved.'
Write-Output 'Remove the port 11435 Tailscale forward separately if no longer needed.'