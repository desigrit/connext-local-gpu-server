# Start a loopback-only Ollama server and require CUDA discovery.
# A Windows job object stops child runners when this launcher is stopped.
param([string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.local.json'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Get-ConnextConfig -Path $ConfigPath
$Port = $config.Port
$OllamaExe = $config.OllamaExe
$ModelsDirectory = $config.ModelsDirectory
$ContextLength = $config.ContextLength
$DiscoveryTimeoutSeconds = $config.DiscoveryTimeoutSeconds
$runtimeDir = $config.RuntimeDirectory
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$statusPath = Join-Path $runtimeDir "server-$Port.json"
$stderrPath = Join-Path $runtimeDir "server-$Port.err.log"
$stdoutPath = Join-Path $runtimeDir "server-$Port.out.log"
$state = [ordered]@{
    State = 'Starting'; Port = $Port; LauncherProcessId = $PID
    ProcessId = $null; StartedUtc = $null; CudaDetected = $false; Error = $null
}
$job = $null
$server = $null
function Save-State { $state | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8 }
try {
    if (-not (Test-Path -LiteralPath $OllamaExe)) { throw 'Ollama executable is missing.' }
    if (-not (Test-Path -LiteralPath (Join-Path $ModelsDirectory 'manifests'))) { throw 'Model manifests directory is missing.' }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -in @('127.0.0.1','0.0.0.0','::','::1') })
    if ($listeners.Count) { throw "Local port $Port is already in use. The existing process was left running." }
    Save-State

    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public sealed class ConnextProcessJob : IDisposable {
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters {
        public ulong ReadOperations, WriteOperations, OtherOperations;
        public ulong ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern SafeFileHandle CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool SetInformationJobObject(SafeFileHandle job, int kind, ref ExtendedLimits limits, uint length);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool AssignProcessToJobObject(SafeFileHandle job, IntPtr process);
    readonly SafeFileHandle handle;
    public ConnextProcessJob() {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
        var limits = new ExtendedLimits();
        limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if (!SetInformationJobObject(handle, 9, ref limits, (uint)Marshal.SizeOf(limits))) {
            int error = Marshal.GetLastWin32Error();
            handle.Dispose();
            throw new Win32Exception(error);
        }
    }
    public void Add(Process process) {
        if (!AssignProcessToJobObject(handle, process.Handle))
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    public void Dispose() { handle.Dispose(); }
}
'@
    $env:OLLAMA_HOST = "127.0.0.1:$Port"
    $env:OLLAMA_MODELS = $ModelsDirectory
    $env:OLLAMA_CONTEXT_LENGTH = [string]$ContextLength
    $env:OLLAMA_NUM_PARALLEL = '1'
    $env:OLLAMA_NO_CLOUD = '1'
    foreach ($log in @($stderrPath,$stdoutPath)) {
        if (Test-Path -LiteralPath $log) { Copy-Item -LiteralPath $log -Destination "$log.previous" -Force }
    }

    $job = New-Object ConnextProcessJob
    $start = @{
        FilePath = $OllamaExe; ArgumentList = @('serve')
        WorkingDirectory = (Split-Path -Parent $OllamaExe)
        WindowStyle = 'Hidden'; PassThru = $true
        RedirectStandardError = $stderrPath; RedirectStandardOutput = $stdoutPath
    }
    $server = Start-Process @start
    try { $job.Add($server) }
    catch {
        if (-not $server.HasExited) { & taskkill.exe /PID $server.Id /T /F | Out-Null }
        throw
    }
    $state.ProcessId = $server.Id
    $state.StartedUtc = $server.StartTime.ToUniversalTime().ToString('o')
    Save-State
    $deadline = (Get-Date).AddSeconds($DiscoveryTimeoutSeconds)
    do {
        $server.Refresh()
        if ($server.HasExited) { throw "Ollama exited during startup, code $($server.ExitCode)." }
        $logText = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
        if ($logText -match 'msg="inference compute"[^\r\n]*library=CUDA') {
            $state.CudaDetected = $true
            break
        }
        if ($logText -match 'msg="inference compute"[^\r\n]*library=cpu') {
            throw 'Ollama found no CUDA GPU. Stopping this instance so Task Scheduler can retry.'
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if (-not $state.CudaDetected) { throw 'CUDA discovery timed out. Task Scheduler will retry.' }
    $version = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/version" -TimeoutSec 5
    $state.State = 'Running'
    $state.Version = $version.version
    Save-State
    # A bounded wait avoids waiting forever on log handles inherited by a runner.
    while (-not $server.WaitForExit(1000)) {}
    throw "Ollama exited, code $($server.ExitCode). Task Scheduler will restart it."
} catch {
    $state.State = 'Failed'
    $state.Error = $_.Exception.Message
    Save-State
    exit 1
} finally {
    if ($job) { $job.Dispose() }
}
