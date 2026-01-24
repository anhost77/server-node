#!/bin/bash

# ServerFlow Agent Installer (Robust + Pre-flight Checks)
set -e

# Parse arguments
TOKEN=""
URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  echo "❌ Error: --token is required"
  exit 1
fi

if [ -z "$URL" ]; then
  echo "❌ Error: --url is required"
  exit 1
fi

echo "� Performing pre-flight check..."

# Check if curl is available for the check
if ! command -v curl &> /dev/null; then
    # If no curl, we try to install it briefly or assume it's there
    # For the pre-flight on a fresh system, we might need to skip if curl is missing
    # but usually, users run the installer via curl | bash, so curl is present.
    echo "⚠️  Curl not found, skipping pre-flight token verification..."
else
    # Verify token with Control Plane
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/servers/verify-token/$TOKEN")
    
    if [ "$STATUS_CODE" -ne 200 ]; then
        echo "❌ Error: The provided token is invalid, expired, or the Control Plane is unreachable."
        echo "   Please generate a new token from the Dashboard."
        exit 1
    fi
    echo "✅ Token verified. Proceeding with installation..."
fi

echo "�🚀 Starting ServerFlow Agent Installation..."

check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Determine if we need sudo
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

# 1. System Dependencies
if ! check_cmd git || ! check_cmd nginx; then
    echo "📦 [1/4] Installing git, nginx & tools..."
    $SUDO apt-get update && $SUDO apt-get install -y git psmisc nginx
    $SUDO systemctl enable nginx
    $SUDO systemctl start nginx
fi

# 2. Node.js
if ! check_cmd node; then
    echo "📦 [2/4] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    $SUDO apt-get install -y nodejs
fi

# 3. pnpm
if ! check_cmd pnpm; then
    echo "📦 [3/4] Installing pnpm..."
    $SUDO npm install -g pnpm
fi

# 4. Workspace setup
echo "📂 [4/4] Preparing workspace..."
INSTALL_DIR="$HOME/.server-flow/agent-bundle"
mkdir -p "$HOME/.server-flow"

if [ -d "$INSTALL_DIR" ]; then rm -rf "$INSTALL_DIR"; fi
mkdir -p "$INSTALL_DIR"

# Download and Extract Bundle
curl -L --progress-bar "$URL/agent-bundle.tar.gz" -o "$HOME/.server-flow/agent-bundle.tar.gz"
tar -xzf "$HOME/.server-flow/agent-bundle.tar.gz" -C "$INSTALL_DIR"
rm "$HOME/.server-flow/agent-bundle.tar.gz"

cd "$INSTALL_DIR"

echo "🔨 Initializing workspace (Installing Deps)..."
pnpm install --filter @server-flow/agent --filter @server-flow/shared > /dev/null 2>&1

# 5. CREATE SYSTEMD SERVICE
echo "⚙️  Configuring background service (systemd)..."

SERVICE_FILE="/etc/systemd/system/server-flow-agent.service"
PNPM_PATH=$(which pnpm)
USER_NAME=$(whoami)

SERVICE_CONTENT="[Unit]
Description=ServerFlow Agent
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$INSTALL_DIR
ExecStartPre=-/bin/bash -c 'fuser -k 3001/tcp || true'
ExecStart=$PNPM_PATH --filter @server-flow/agent dev -- --token $TOKEN --url $URL
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin:$PATH

[Install]
WantedBy=multi-user.target"

# Write service file (requires sudo)
echo "$SERVICE_CONTENT" | $SUDO tee $SERVICE_FILE > /dev/null

# Reload and Start
$SUDO systemctl daemon-reload
$SUDO systemctl enable server-flow-agent
$SUDO systemctl restart server-flow-agent

echo "✨ Installation Success!"
echo "📡 Agent is now running in the background."
echo "✅ Check your Dashboard at $URL"
