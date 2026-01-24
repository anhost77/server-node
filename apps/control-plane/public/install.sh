#!/bin/bash

# ServerFlow Agent Installer (Verbose Edition)
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
    echo "📦 [3/5] Installing Node.js 20 (Downloading repository)..."
    if [ -n "$SUDO" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    fi
    echo "📦 [3/5] Compiling and installing Node.js binary..."
    $SUDO apt-get install -y nodejs
fi

# 3. pnpm
if ! check_cmd pnpm; then
    echo "📦 [4/5] Installing pnpm..."
    $SUDO npm install -g pnpm
fi

# 4. Workspace setup
echo "📂 [5/5] Preparing workspace..."
mkdir -p ~/.server-flow
cd ~/.server-flow

if [ ! -d "server-node" ]; then
    echo "📥 Cloning project repository..."
    git clone --depth 1 https://github.com/anhost77/server-node.git
else
    echo "🔄 Updating project source..."
    cd server-node && git pull && cd ..
fi

cd server-node

echo "🔨 Initializing dependencies..."
# Removed redirection to /dev/null so user can see progress
pnpm install --filter @server-flow/agent --filter @server-flow/shared

echo "✨ Configuration complete!"
echo "📡 Linking agent to control plane at $URL..."

# 5. Start Agent - Force build of shared first just in case
pnpm --filter @server-flow/shared build

# Use npx tsx to ensure we run the TS files directly
npx tsx apps/agent/src/index.ts --token $TOKEN --url $URL
