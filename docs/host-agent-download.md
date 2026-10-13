# Shambu host companion 0.2.2

Run this on your Windows GPU PC to share its name, connection checks, GPU history, load, and VRAM usage with your other devices.

Open Windows PowerShell as Administrator in this folder, using the same account as Shambu.

For an existing installation, first run:

```powershell
.\Uninstall-ShambuAgent.ps1
```

Then install:

```powershell
.\Install-ShambuAgent.ps1 -AgentExe .\shambu-agent.exe
```

Your pairing key and GPU history are preserved. Ollama keeps running.

[Setup guide](https://github.com/desigrit/shambu/blob/main/docs/host-agent.md)
