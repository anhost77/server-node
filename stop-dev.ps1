# stop-dev.ps1 - Arrete les serveurs de dev
# Usage: .\stop-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== Arret des serveurs ServerFlow ===" -ForegroundColor Cyan
Write-Host ""

function Stop-ProcessOnPort {
    param([int]$Port)

    $connections = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    $found = $false
    foreach ($conn in $connections) {
        if ($conn -match '\s+(\d+)\s*$') {
            $processId = [int]$matches[1]
            Write-Host "Arret du processus $processId sur le port $Port..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "  OK" -ForegroundColor Green
                $found = $true
            } catch {
                Write-Host "  Echec: $_" -ForegroundColor Red
            }
        }
    }
    if (-not $found) {
        Write-Host "Aucun processus sur le port $Port" -ForegroundColor Gray
    }
}

Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 5173

Write-Host ""
Write-Host "Serveurs arretes." -ForegroundColor Green
