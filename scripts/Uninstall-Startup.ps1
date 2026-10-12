# Remove only the managed task for this checkout. Keep models, configuration, and logs.
[CmdletBinding(SupportsShouldProcess,ConfirmImpact='High')]
param([string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.local.json'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Get-ConnextConfig -Path $ConfigPath
$task = Get-ScheduledTask -TaskName $config.TaskName -ErrorAction Stop
Assert-ConnextTask -Task $task -Config $config
if (-not $PSCmdlet.ShouldProcess($config.TaskName,'Disable recovery, stop Ollama, and remove its startup task')) { return }
Disable-ScheduledTask -TaskName $config.TaskName | Out-Null
Stop-ScheduledTask -TaskName $config.TaskName
$deadline = (Get-Date).AddSeconds(15)
do {
    if (-not (Get-ConnextListener -Port $config.Port)) { break }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)
if (Get-ConnextListener -Port $config.Port) {
    throw 'The local port is still occupied. The task is disabled but retained for inspection.'
}
Unregister-ScheduledTask -TaskName $config.TaskName -Confirm:$false
Write-Output 'Task removed. Models and local files were preserved. Re-enable the Ollama login app manually if wanted.'
