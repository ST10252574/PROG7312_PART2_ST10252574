$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webArtifact = Join-Path $repoRoot "artifacts/smartx-gateway"
$staticOutput = Join-Path $webArtifact "dist/public"
$wwwroot = Join-Path $PSScriptRoot "SmartX.Gateway.Api/wwwroot"

Push-Location $repoRoot
try {
    $env:PORT = "5173"
    $env:BASE_PATH = "/"
    pnpm --filter @workspace/smartx-gateway run build
    if ($LASTEXITCODE -ne 0) {
        throw "The Smart-X dashboard build failed with exit code $LASTEXITCODE."
    }

    if (Test-Path $wwwroot) {
        Remove-Item $wwwroot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $wwwroot -Force | Out-Null
    Copy-Item (Join-Path $staticOutput "*") $wwwroot -Recurse -Force
    Write-Host "Dashboard copied to $wwwroot"
}
finally {
    Pop-Location
}
