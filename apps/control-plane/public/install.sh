#!/bin/bash

# ServerFlow Agent Installer (Direct Bundle Mode)
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

echo "🚀 Starting ServerFlow Agent Installation (Standalone)..."

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

# 4. Workspace setup (No GitHub Needed)
echo "📂 [4/4] Fetching ServerFlow Agent bundle from $URL..."
mkdir -p ~/.server-flow
cd ~/.server-flow

# Clear old version if exists
if [ -d "agent-bundle" ]; then rm -rf agent-bundle; fi
mkdir -p agent-bundle

# Download and Extract Bundle directly from Control Plane
curl -sSL "$URL/agent-bundle.tar.gz" -o agent-bundle.tar.gz
tar -xzf agent-bundle.tar.gz -C agent-bundle
rm agent-bundle.tar.gz

cd agent-bundle

echo "🔨 Finalizing local configuration..."
# Install only production dependencies for the agent to save RAM
pnpm install --filter @server-flow/agent --filter @server-flow/shared > /dev/null 2>&1

echo "✨ Installation Successful!"
echo "📡 Linking agent to control plane at $URL..."

# 5. Start Agent
npx tsx apps/agent/src/index.ts --token $TOKEN --url $URL
