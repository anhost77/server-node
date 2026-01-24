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

# 1. Check for basic tools
check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Ensure we are root for apt commands if needed
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

if ! check_cmd curl; then
    echo "📦 Installing curl..."
    $SUDO apt-get update && $SUDO apt-get install -y curl
fi

if ! check_cmd git; then
    echo "📦 Installing git..."
    $SUDO apt-get update && $SUDO apt-get install -y git
fi

# 2. Check for Node.js
if ! check_cmd node; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
fi

# 3. Check for pnpm
if ! check_cmd pnpm; then
    echo "📦 Installing pnpm..."
    $SUDO npm install -g pnpm
fi

# 4. Create and Prepare Directory
mkdir -p ~/.server-flow
cd ~/.server-flow

if [ ! -d "server-node" ]; then
    echo "📥 Cloning ServerFlow Repository..."
    git clone https://github.com/anhost77/server-node.git
else
    echo "🔄 Updating ServerFlow Repository..."
    cd server-node && git pull && cd ..
fi

cd server-node

# 5. Build and Start
echo "🔨 Initializing Workspace..."
pnpm install

echo "🏁 Starting ServerFlow Agent..."
# We run the agent in the background or use a screen/tmux/systemd in real world
# For now, we'll start it and the user can see it in their terminal output
# In a real installer, this would be a systemd service.
pnpm --filter @server-flow/agent dev -- --token $TOKEN --url $URL
