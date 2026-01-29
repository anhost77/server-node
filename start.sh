#!/bin/bash
set -e

echo "============================================"
echo " ServerFlow - Installation et Démarrage"
echo "============================================"
echo ""

# Obtenir le chemin absolu du dossier server-node
SERVER_NODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SERVER_NODE_DIR"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Vérification de Node.js
echo "[1/7] Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERREUR]${NC} Node.js n'est pas installé."
    echo "Installez Node.js depuis https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js $(node --version) est installé."

# 2. Vérification et installation de pnpm
echo ""
echo "[2/7] Vérification de pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}[INFO]${NC} pnpm n'est pas installé. Installation en cours..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERREUR]${NC} Échec de l'installation de pnpm."
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} pnpm installé avec succès."
else
    echo -e "${GREEN}[OK]${NC} pnpm $(pnpm --version) est installé."
fi

# 3. Installation des dépendances
echo ""
echo "[3/7] Installation des dépendances..."
pnpm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERREUR]${NC} Échec de l'installation des dépendances."
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Dépendances installées."

# 4. Compilation du package shared
echo ""
echo "[4/7] Compilation du package shared..."
pnpm --filter @server-flow/shared build
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERREUR]${NC} Échec de la compilation du package shared."
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Package shared compilé."

# 5. Configuration de l'environnement
echo ""
echo "[5/7] Configuration de l'environnement..."

NEED_CONFIG=0

if [ ! -f "apps/control-plane/.env" ]; then
    NEED_CONFIG=1
else
    # Vérifier si les clés GitHub sont configurées
    if grep -q "GITHUB_CLIENT_ID=your_github_client_id_here" "apps/control-plane/.env" 2>/dev/null; then
        NEED_CONFIG=1
    elif grep -q "GITHUB_CLIENT_ID=$" "apps/control-plane/.env" 2>/dev/null; then
        NEED_CONFIG=1
    elif grep -q "GITHUB_CLIENT_ID=\"\"" "apps/control-plane/.env" 2>/dev/null; then
        NEED_CONFIG=1
    fi
fi

if [ "$NEED_CONFIG" -eq 1 ]; then
    echo -e "${YELLOW}[INFO]${NC} Configuration requise pour le fichier .env..."
    echo ""
    echo "============================================"
    echo " Configuration GitHub OAuth (Optionnel)"
    echo "============================================"
    echo ""
    echo "GitHub OAuth est requis pour l'authentification des utilisateurs."
    echo "Vous pouvez configurer cela maintenant ou plus tard."
    echo ""
    echo "Pour obtenir vos clés GitHub OAuth :"
    echo "1. Allez sur https://github.com/settings/developers"
    echo "2. Cliquez sur 'New OAuth App'"
    echo "3. Configurez :"
    echo "   - Application name : ServerFlow Local"
    echo "   - Homepage URL : http://localhost:5173"
    echo "   - Callback URL : http://localhost:3000/api/auth/github/callback"
    echo ""

    read -p "Voulez-vous configurer GitHub OAuth maintenant ? (o/N) : " CONFIGURE_GITHUB

    GITHUB_CLIENT_ID=""
    GITHUB_CLIENT_SECRET=""

    if [[ "$CONFIGURE_GITHUB" =~ ^[oO]$ ]]; then
        echo ""
        read -p "Entrez votre GitHub Client ID : " GITHUB_CLIENT_ID
        read -p "Entrez votre GitHub Client Secret : " GITHUB_CLIENT_SECRET
        echo -e "${GREEN}[OK]${NC} GitHub OAuth configuré."
    else
        echo -e "${YELLOW}[INFO]${NC} GitHub OAuth non configuré. Vous pourrez le faire plus tard dans apps/control-plane/.env"
        GITHUB_CLIENT_ID="your_github_client_id_here"
        GITHUB_CLIENT_SECRET="your_github_client_secret_here"
    fi

    echo ""
    echo -e "${YELLOW}[INFO]${NC} Création du fichier .env..."
    cat > "apps/control-plane/.env" << EOF
NODE_ENV=development
CONTROL_PLANE_URL=http://localhost:3000
APP_URL=http://localhost:5173
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MODE=test
HETZNER_API_TOKEN=
DIGITALOCEAN_API_TOKEN=
VULTR_API_KEY=
EOF

    echo -e "${GREEN}[OK]${NC} Fichier .env créé avec succès."
else
    echo -e "${GREEN}[OK]${NC} Fichier .env existe et est configuré."
fi

# 6. Vérification et initialisation de la base de données
echo ""
echo "[6/7] Vérification de la base de données..."
if [ ! -f "apps/control-plane/data/auth.db" ]; then
    echo -e "${YELLOW}[INFO]${NC} Base de données introuvable. Génération des migrations..."
    cd apps/control-plane
    npx drizzle-kit generate:sqlite
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERREUR]${NC} Échec de la génération des migrations."
        cd ../..
        exit 1
    fi

    echo -e "${YELLOW}[INFO]${NC} Application des migrations..."
    cat > migrate-temp.mjs << 'EOF'
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const client = createClient({ url: 'file:data/auth.db' });
const migrationSQL = readFileSync(join(process.cwd(), 'drizzle', '0000_melodic_nuke.sql'), 'utf-8');
const statements = migrationSQL.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);

for (const statement of statements) {
    if (statement.trim()) await client.execute(statement);
}
console.log('Migration terminée');
EOF

    node migrate-temp.mjs
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERREUR]${NC} Échec de l'application des migrations."
        rm migrate-temp.mjs
        cd ../..
        exit 1
    fi
    rm migrate-temp.mjs
    cd ../..
    echo -e "${GREEN}[OK]${NC} Base de données initialisée."
else
    echo -e "${GREEN}[OK]${NC} Base de données existe."
fi

# 7. Démarrage du projet
echo ""
echo "[7/7] Démarrage du projet..."
echo ""
echo "============================================"
echo " ServerFlow démarré !"
echo "============================================"
echo " Dashboard : http://localhost:5173"
echo " API       : http://localhost:3000"
echo "============================================"
echo ""
echo "Pour arrêter le serveur, appuyez sur Ctrl+C"
echo ""

pnpm dev
