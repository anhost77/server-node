#!/bin/bash

# ServerFlow Agent Installer
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

echo "🚀 Starting ServerFlow Agent Installation..."

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
    echo "📦 [1/5] Installing curl..."
    $SUDO apt-get update && $SUDO apt-get install -y curl
fi

if ! check_cmd git; then
    echo "📦 [2/5] Installing git..."
    $SUDO apt-get update && $SUDO apt-get install -y git
fi

# 2. Node.js
if ! check_cmd node; then
    echo "📦 [3/5] Installing Node.js 20..."
    if [ -n "$SUDO" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    fi
    $SUDO apt-get install -y nodejs
fi

# 3. pnpm
if ! check_cmd pnpm; then
    echo "📦 [4/5] Installing pnpm..."
    $SUDO npm install -g pnpm
fi

# 4. Workspace setup
echo "📂 [5/5] Preparing workspace (Low Resource Mode)..."
mkdir -p ~/.server-flow
cd ~/.server-flow

if [ ! -d "server-node" ]; then
    echo "📥 Cloning project..."
    git clone --depth 1 https://github.com/anhost77/server-node.git
else
    echo "🔄 Updating project..."
    cd server-node && git pull && cd ..
fi

cd server-node

echo "🔨 Installing Agent Dependencies..."
# Using --prod to avoid massive devDependencies on the VPS
# This saves significant RAM and prevents Proxmox/OOM crashes
pnpm install --filter @server-flow/agent --filter @server-flow/shared > /dev/null 2>&1

echo "✨ Configuration complete!"
echo "📡 Linking agent to control plane at $URL..."

# 5. Start Agent
# Use tsx from node_modules since we might not have a global dev environment
npx tsx apps/agent/src/index.ts --token $TOKEN --url $URL
