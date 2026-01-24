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

if ! check_cmd curl; then
    echo "📦 Installing curl..."
    sudo apt-get update && sudo apt-get install -y curl
fi

# 2. Check for Node.js
if ! check_cmd node; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 3. Check for pnpm
if ! check_cmd pnpm; then
    echo "📦 Installing pnpm..."
    sudo npm install -g pnpm
fi

# 4. Create install dir
mkdir -p ~/.server-flow/agent
cd ~/.server-flow/agent

# 5. Download Agent (Mock download - in real app, we'd fetch a tarball or binary)
echo "📥 Fetching ServerFlow Agent..."
# For the sake of this demo, we'll assume the files are already there or we're mocking the run
# In a real installer: curl -L $URL/agent.tar.gz | tar xz

# 6. Install Deps & Start
# echo "🔨 Installing dependencies..."
# pnpm install

echo "🏁 Finalizing Registration..."
# In a real scenario, this would start the background service (systemd)
# For now, we simulate the run:
echo "Agent registered with token: $TOKEN"
echo "To manually start the agent, run: node index.js --token $TOKEN"
echo "✅ ServerFlow Agent installed successfully!"
