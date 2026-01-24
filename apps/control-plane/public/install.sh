#!/bin/bash

# ServerFlow Agent Installer (Background Service Mode)
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

echo "🚀 Starting ServerFlow Agent Installation (Background Service)..."

check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Determine if we need sudo
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

# 1. System Dependencies
if ! check_cmd curl; then
    echo "📦 [1/4] Installing curl..."
    $SUDO apt-get update && $SUDO apt-get install -y curl
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
# Detect actual node and pnpm paths
NODE_PATH=$(which node)
PNPM_PATH=$(which pnpm)
USER_NAME=$(whoami)

SERVICE_CONTENT="[Unit]
Description=ServerFlow Agent
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_PATH $INSTALL_DIR/node_modules/tsx/dist/cli.mjs $INSTALL_DIR/apps/agent/src/index.ts --token $TOKEN --url $URL
Restart=always
Environment=NODE_ENV=production

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
echo "📜 To see logs: sudo journalctl -u server-flow-agent -f"
echo "✅ Check your Dashboard at $URL"
