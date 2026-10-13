# Shared paths and ownership checks for the optional read-only host companion.
function Get-ShambuAgentPaths {
    if (-not $env:LOCALAPPDATA -or -not [IO.Path]::IsPathRooted($env:LOCALAPPDATA)) {
        throw 'The current account has no absolute local app-data path.'
    }
    $directory = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Shambu\agent'))
    [pscustomobject]@{
        Directory = $directory
        Config = Join-Path $directory 'config.json'
        BinaryDirectory = Join-Path $directory 'bin'
        Binary = Join-Path $directory 'bin\shambu-agent.exe'
    }
}

function Assert-ShambuTaskName {
    param([string]$TaskName)
    if ($TaskName -notmatch '^Shambu-Agent(?:-[A-Za-z0-9_-]{1,40})?$') {
        throw 'Use Shambu-Agent or a name starting with Shambu-Agent- followed by letters, numbers, underscores, or hyphens.'
    }
}

function Assert-ShambuAgentTask {
    param($Task, $Paths)
    $actions = @($Task.Actions)
    if ($actions.Count -ne 1 -or
        $actions[0].Execute -ne $Paths.Binary -or
        -not [string]::IsNullOrWhiteSpace($actions[0].Arguments) -or
        $actions[0].WorkingDirectory -ne $Paths.BinaryDirectory) {
        throw 'This task does not match the managed Shambu companion action. No task was changed.'
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $taskAccount = [Security.Principal.NTAccount]::new($Task.Principal.UserId)
        $taskSid = $taskAccount.Translate([Security.Principal.SecurityIdentifier]).Value
    } catch {
        try {
            $taskSid = [Security.Principal.SecurityIdentifier]::new($Task.Principal.UserId).Value
        } catch {
            throw 'Could not verify the account that owns this task. No task was changed.'
        }
    }
    if ($taskSid -ne $identity.User.Value) {
        throw 'This task belongs to another account. No task was changed.'
    }
}

function Get-ShambuAgentListener {
    @(Get-NetTCPConnection -LocalPort 11435 -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::1', '::') })
}

function Read-ShambuAgentConfig {
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path -ErrorAction Stop
    if ($item.Length -gt 16384 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'The private companion configuration is not a regular, supported file.'
    }
    try { $config = [IO.File]::ReadAllText($item.FullName) | ConvertFrom-Json } catch {
        throw 'The private companion configuration could not be read.'
    }
    if ($config.protocolVersion -ne 1 -or
        $config.pairingKey -isnot [string] -or
        $config.pairingKey -cnotmatch '^[0-9a-f]{64}$') {
        throw 'The private companion configuration is invalid.'
    }
    $config
}
function Test-ShambuAppDataRedirected {
    if (-not ('ShambuAppDataPaths' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class ShambuAppDataPaths {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern SafeFileHandle CreateFileW(string path, uint access, uint sharing, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle file, StringBuilder path, uint length, uint flags);
    public static string ResolveDirectory(string path) {
        using (var handle = CreateFileW(path, 0, 7, IntPtr.Zero, 3, 0x02000000, IntPtr.Zero)) {
            if (handle.IsInvalid) throw new InvalidOperationException("Could not inspect the app-data directory.");
            var text = new StringBuilder(32768);
            uint count = GetFinalPathNameByHandleW(handle, text, 32768, 0);
            if (count == 0 || count >= 32768) throw new InvalidOperationException("Could not resolve the app-data directory.");
            return text.ToString().TrimEnd('\\');
        }
    }
}
"@
    }
    # Child processes can inherit redirection without a package identity, so test a
    # new empty directory's actual file handle rather than only querying package identity.
    $name = 'Shambu-SetupCheck-' + [guid]::NewGuid().ToString('N')
    $probe = Join-Path $env:LOCALAPPDATA $name
    $created = $false
    try {
        $parent = [ShambuAppDataPaths]::ResolveDirectory($env:LOCALAPPDATA)
        if (Test-Path -LiteralPath $probe) { throw 'The temporary app-data check path is occupied.' }
        New-Item -ItemType Directory -Path $probe -ErrorAction Stop | Out-Null
        $created = $true
        $actual = [ShambuAppDataPaths]::ResolveDirectory($probe)
        $expected = $parent + '\' + $name
        return -not [string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase)
    } finally {
        # This is the exact empty directory just created, never a recursive removal.
        if ($created) { [IO.Directory]::Delete($probe,$false) }
    }
}