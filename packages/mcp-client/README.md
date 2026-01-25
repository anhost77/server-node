# ServerFlow MCP Client

Connect Claude Desktop to your ServerFlow infrastructure using the Model Context Protocol (MCP).

## Installation

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "serverflow": {
      "command": "npx",
      "args": ["-y", "serverflow-mcp@latest"],
      "env": {
        "SERVERFLOW_API_KEY": "sf_mcp_your_token_here",
        "SERVERFLOW_URL": "https://your-serverflow-instance.com"
      }
    }
  }
}
```

## Available Tools

- **list_servers** - List all your servers and their status
- **list_apps** - List all deployed applications
- **deploy_app** - Trigger a deployment (supports dry-run)
- **app_action** - Start, stop, or restart an app
- **get_activity_logs** - View recent activity

## Example Prompts

- "Show me all my servers"
- "Deploy my-api to production"
- "Restart the frontend app"
- "What happened in the last hour?"

## Get Your API Key

1. Log in to your ServerFlow dashboard
2. Go to **MCP Bridge** in the sidebar
3. Click **Generate Token**
4. Copy the token (shown only once!)

## License

MIT
