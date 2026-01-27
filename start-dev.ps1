# start-dev.ps1 - Lance les serveurs de dev (Control Plane + Dashboard)
# Usage: .\start-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== ServerFlow Dev Servers ===" -ForegroundColor Cyan
Write-Host ""

# Fonction pour tuer les processus sur un port
function Stop-ProcessOnPort {
    param([int]$Port)

    $connections = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    foreach ($conn in $connections) {
        if ($conn -match '\s+(\d+)\s*$') {
            $processId = [int]$matches[1]
            Write-Host "Arret du processus $processId sur le port $Port..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "  OK" -ForegroundColor Green
            } catch {
                Write-Host "  Echec: $_" -ForegroundColor Red
            }
        }
    }
}

# Liberer les ports
Write-Host "[1/3] Liberation des ports..." -ForegroundColor White
Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 5173
Start-Sleep -Seconds 2

# Aller dans le dossier du projet
Set-Location $PSScriptRoot

# Lancer le Control Plane
Write-Host "[2/3] Lancement du Control Plane (port 3000)..." -ForegroundColor White
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm --filter @server-flow/control-plane dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# Lancer le Dashboard
Write-Host "[3/3] Lancement du Dashboard (port 5173)..." -ForegroundColor White
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm --filter @server-flow/dashboard dev" -WindowStyle Normal

Write-Host ""
Write-Host "Serveurs lances!" -ForegroundColor Green
Write-Host ""
Write-Host "  Control Plane: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Dashboard:     http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Chaque serveur tourne dans sa propre fenetre PowerShell." -ForegroundColor Gray
Write-Host "Fermez les fenetres pour arreter les serveurs." -ForegroundColor Gray
