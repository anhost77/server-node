import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const CP_URL = process.env.CONTROL_PLANE_URL || "http://localhost:3000";

const server = new Server(
    {
        name: "server-flow-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_servers",
                description: "List all registered servers and their connection status",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "deploy_app",
                description: "Trigger a deployment for a specific repository",
                inputSchema: {
                    type: "object",
                    properties: {
                        repoUrl: {
                            type: "string",
                            description: "The HTTPS clone URL of the repository",
                        },
                    },
                    required: ["repoUrl"],
                },
            },
        ],
    };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
        case "list_servers": {
            try {
                const response = await axios.get(`${CP_URL}/api/internal/servers`);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(response.data, null, 2),
                        },
                    ],
                };
            } catch (error: any) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error fetching servers: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }

        case "deploy_app": {
            const { repoUrl } = request.params.arguments as { repoUrl: string };
            try {
                // We simulate a webhook call to the Control Plane
                await axios.post(`${CP_URL}/api/webhooks/github`, {
                    repository: { clone_url: repoUrl },
                    ref: "refs/heads/main",
                    after: "latest", // MCP version of "latest"
                }, {
                    headers: {
                        'x-hub-signature-256': 'sha256=MOCK_SIGNATURE' // We'll need to bypass signature for internal calls or use a real secret
                    }
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: `Deployment triggered for ${repoUrl}`,
                        },
                    ],
                };
            } catch (error: any) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error triggering deployment: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }

        default:
            throw new Error("Unknown tool");
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
