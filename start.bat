@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  ServerFlow - Installation et Demarrage
echo ============================================
echo.

REM Obtenir le chemin absolu du dossier server-node
set "SERVER_NODE_DIR=%~dp0"
cd /d "%SERVER_NODE_DIR%"

REM 1. Verification de Node.js
echo [1/7] Verification de Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe.
    echo Telechargez et installez Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js est installe.

REM 2. Verification et installation de pnpm
echo.
echo [2/7] Verification de pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] pnpm n'est pas installe. Installation en cours...
    call npm install -g pnpm
    if errorlevel 1 (
        echo [ERREUR] Echec de l'installation de pnpm.
        pause
        exit /b 1
    )
    echo [OK] pnpm installe avec succes.
    echo [INFO] Veuillez fermer et rouvrir ce terminal pour actualiser le PATH.
    echo [INFO] Puis relancez ce script.
    pause
    exit /b 0
) else (
    echo [OK] pnpm est installe.
)

REM 3. Installation des dependances
echo.
echo [3/7] Installation des dependances...
call pnpm install
if errorlevel 1 (
    echo [ERREUR] Echec de l'installation des dependances.
    pause
    exit /b 1
)
echo [OK] Dependances installees.

REM 4. Compilation du package shared
echo.
echo [4/7] Compilation du package shared...
call pnpm --filter @server-flow/shared build
if errorlevel 1 (
    echo [ERREUR] Echec de la compilation du package shared.
    pause
    exit /b 1
)
echo [OK] Package shared compile.

REM 5. Configuration de l'environnement
echo.
echo [5/7] Configuration de l'environnement...

set "NEED_CONFIG=0"

if not exist "apps\control-plane\.env" (
    set "NEED_CONFIG=1"
) else (
    REM Verifier si les cles GitHub sont configurees
    findstr /C:"GITHUB_CLIENT_ID=your_github_client_id_here" "apps\control-plane\.env" >nul 2>&1
    if not errorlevel 1 set "NEED_CONFIG=1"

    findstr /C:"GITHUB_CLIENT_ID=$" "apps\control-plane\.env" >nul 2>&1
    if not errorlevel 1 set "NEED_CONFIG=1"
)

if "!NEED_CONFIG!"=="1" (
    echo [INFO] Configuration requise pour le fichier .env...
    echo.
    echo ============================================
    echo  Configuration GitHub OAuth (Optionnel)
    echo ============================================
    echo.
    echo GitHub OAuth est requis pour l'authentification des utilisateurs.
    echo Vous pouvez configurer cela maintenant ou plus tard.
    echo.
    echo Pour obtenir vos cles GitHub OAuth :
    echo 1. Allez sur https://github.com/settings/developers
    echo 2. Cliquez sur "New OAuth App"
    echo 3. Configurez :
    echo    - Application name : ServerFlow Local
    echo    - Homepage URL : http://localhost:5173
    echo    - Callback URL : http://localhost:3000/api/auth/github/callback
    echo.

    set /p CONFIGURE_GITHUB="Voulez-vous configurer GitHub OAuth maintenant ? (o/N) : "

    set "GITHUB_CLIENT_ID="
    set "GITHUB_CLIENT_SECRET="

    if /i "!CONFIGURE_GITHUB!"=="o" (
        echo.
        set /p GITHUB_CLIENT_ID="Entrez votre GitHub Client ID : "
        set /p GITHUB_CLIENT_SECRET="Entrez votre GitHub Client Secret : "
        echo [OK] GitHub OAuth configure.
    ) else (
        echo [INFO] GitHub OAuth non configure. Vous pourrez le faire plus tard dans apps\control-plane\.env
        set "GITHUB_CLIENT_ID=your_github_client_id_here"
        set "GITHUB_CLIENT_SECRET=your_github_client_secret_here"
    )

    echo.
    echo [INFO] Creation du fichier .env...
    (
        echo NODE_ENV=development
        echo CONTROL_PLANE_URL=http://localhost:3000
        echo APP_URL=http://localhost:5173
        echo GITHUB_CLIENT_ID=!GITHUB_CLIENT_ID!
        echo GITHUB_CLIENT_SECRET=!GITHUB_CLIENT_SECRET!
        echo GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
        echo STRIPE_SECRET_KEY=
        echo STRIPE_PUBLISHABLE_KEY=
        echo STRIPE_WEBHOOK_SECRET=
        echo STRIPE_MODE=test
        echo HETZNER_API_TOKEN=
        echo DIGITALOCEAN_API_TOKEN=
        echo VULTR_API_KEY=
    ) > "apps\control-plane\.env"

    echo [OK] Fichier .env cree avec succes.
) else (
    echo [OK] Fichier .env existe et est configure.
)

REM 6. Verification et initialisation de la base de donnees
echo.
echo [6/7] Verification de la base de donnees...
if not exist "apps\control-plane\data\auth.db" (
    echo [INFO] Base de donnees introuvable. Generation des migrations...
    cd apps\control-plane
    call npx drizzle-kit generate:sqlite
    if errorlevel 1 (
        echo [ERREUR] Echec de la generation des migrations.
        cd ..\..
        pause
        exit /b 1
    )

    echo [INFO] Application des migrations...
    (
        echo import { createClient } from '@libsql/client';
        echo import { readFileSync } from 'fs';
        echo import { join } from 'path';
        echo.
        echo const client = createClient({ url: 'file:data/auth.db' });
        echo const migrationSQL = readFileSync^(join^(process.cwd^(^), 'drizzle', '0000_melodic_nuke.sql'^), 'utf-8'^);
        echo const statements = migrationSQL.split^('--%3E statement-breakpoint'^).map^(s =%3E s.trim^(^)^).filter^(s =%3E s.length %3E 0^);
        echo.
        echo for ^(const statement of statements^) {
        echo     if ^(statement.trim^(^)^) await client.execute^(statement^);
        echo }
        echo console.log^('Migration terminee'^);
    ) > migrate-temp.mjs

    call node migrate-temp.mjs
    if errorlevel 1 (
        echo [ERREUR] Echec de l'application des migrations.
        del migrate-temp.mjs
        cd ..\..
        pause
        exit /b 1
    )
    del migrate-temp.mjs
    cd ..\..
    echo [OK] Base de donnees initialisee.
) else (
    echo [OK] Base de donnees existe.
)

REM 7. Demarrage du projet
echo.
echo [7/7] Demarrage du projet...
echo.
echo ============================================
echo  ServerFlow demarre !
echo ============================================
echo  Dashboard : http://localhost:5173
echo  API       : http://localhost:3000
echo ============================================
echo.
echo Pour arreter le serveur, appuyez sur Ctrl+C
echo.

call pnpm dev
