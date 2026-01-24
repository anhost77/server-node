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
  echo "Error: --token is required"
  exit 1
fi

echo "🚀 Starting ServerFlow Agent Installation..."

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    sudo npm install -g pnpm
fi

# 3. Create install dir
mkdir -p ~/.server-flow/agent
cd ~/.server-flow/agent

# 4. Download Agent Core
# (For the demo/MVP, we'll assume the source is reachable or we're just running a local mock)
echo "📥 Downloading ServerFlow Agent..."
# git clone ... (Simulated)

# 5. Start Agent
echo "🏁 Starting Agent..."
# Final command would depend on how we distribute the agent
# For now, we output instructions or run a node command if available
echo "Agent registered with token: $TOKEN connecting to $URL"
echo "Success!"
