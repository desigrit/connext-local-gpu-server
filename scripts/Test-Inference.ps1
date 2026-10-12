# This sends a small inference request. Run only when the GPU is available.
param(
    [string]$BaseUrl = 'http://127.0.0.1:11434',
    [string]$Model = 'qwen3:8b'
)
$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$uri = [uri]$base
if ($uri.Scheme -notin @('http','https') -or -not $uri.IsAbsoluteUri -or $uri.UserInfo) {
    throw 'BaseUrl must be an HTTP(S) URL without embedded credentials.'
}
$version = Invoke-RestMethod -Uri "$base/api/version" -TimeoutSec 10
$available = (Invoke-RestMethod -Uri "$base/api/tags" -TimeoutSec 10).models
if (-not ($available | Where-Object { $_.name -eq $Model })) { throw 'The requested model is not downloaded on this server.' }
$body = @{
    model = $Model; prompt = 'Reply with just OK.'; stream = $false; think = $false
    keep_alive = '1m'; options = @{ num_predict = 8; num_ctx = 2048 }
} | ConvertTo-Json -Depth 4
$reply = Invoke-RestMethod -Uri "$base/api/generate" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
$loaded = (Invoke-RestMethod -Uri "$base/api/ps" -TimeoutSec 10).models |
    Where-Object { $_.name -eq $Model } | Select-Object -First 1
if (-not $reply.done -or -not $loaded -or $loaded.size_vram -le 0) { throw 'The request did not confirm GPU inference.' }
[pscustomobject]@{
    Version = $version.version; Model = $Model; Response = $reply.response
    GpuMemoryBytes = $loaded.size_vram; LoadedBytes = $loaded.size
    ContextLength = $loaded.context_length
}
# The test leaves its model cached for one minute. This is normal Ollama behavior.
