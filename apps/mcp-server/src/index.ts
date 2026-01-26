import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const CP_URL = process.env.CONTROL_PLANE_URL || "http://localhost:3000";
const MCP_TOKEN = process.env.MCP_API_TOKEN || "mcp-internal-token";

const server = new Server(
    {
        name: "server-flow-mcp",
        version: "0.3.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Helper for authenticated requests
async function cpRequest(method: 'get' | 'post' | 'delete', path: string, data?: any) {
    return axios({
        method,
        url: `${CP_URL}${path}`,
        data,
        headers: { 'x-mcp-token': MCP_TOKEN }
    });
}

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_servers",
                description: "List all registered servers and their connection status",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "list_apps",
                description: "List all registered applications",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "deploy_app",
                description: "Trigger a deployment for a specific application by name or ID",
                inputSchema: {
                    type: "object",
                    properties: {
                        appName: { type: "string", description: "The application name or ID" },
                        commitHash: { type: "string", description: "Git commit/branch/tag to deploy (default: main)" },
                        dryRun: { type: "boolean", description: "If true, only simulate the deployment" }
                    },
                    required: ["appName"],
                },
            },
            {
                name: "restart_service",
                description: "Restart a system service (nginx or pm2) on a specific server",
                inputSchema: {
                    type: "object",
                    properties: {
                        serverId: { type: "string", description: "The server ID (first 12 chars is enough)" },
                        service: { type: "string", enum: ["nginx", "pm2"], description: "The service to restart" },
                        dryRun: { type: "boolean", description: "If true, only simulate the restart" }
                    },
                    required: ["serverId", "service"],
                },
            },
            {
                name: "app_action",
                description: "Perform an action on an application (start, stop, restart)",
                inputSchema: {
                    type: "object",
                    properties: {
                        appName: { type: "string", description: "The application name or ID" },
                        action: { type: "string", enum: ["start", "stop", "restart"], description: "The action to perform" },
                        dryRun: { type: "boolean", description: "If true, only simulate the action" }
                    },
                    required: ["appName", "action"],
                },
            },
            {
                name: "get_activity_logs",
                description: "Get recent activity logs from the system",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number", description: "Maximum number of logs to return (default: 20)" }
                    },
                },
            },
            {
                name: "provision_domain",
                description: "Provision a new domain with Nginx reverse proxy and SSL",
                inputSchema: {
                    type: "object",
                    properties: {
                        serverId: { type: "string", description: "The server ID" },
                        domain: { type: "string", description: "The domain name (e.g., api.example.com)" },
                        port: { type: "number", description: "The backend port to proxy to" },
                        dryRun: { type: "boolean", description: "If true, only validate without provisioning" }
                    },
                    required: ["serverId", "domain", "port"],
                },
            },
            {
                name: "get_server_infrastructure",
                description: "Get the infrastructure status of a server (installed runtimes, databases, system info). Results are async - check Dashboard for full details.",
                inputSchema: {
                    type: "object",
                    properties: {
                        serverId: { type: "string", description: "The server ID (first 12 chars is enough)" }
                    },
                    required: ["serverId"],
                },
            },
            {
                name: "install_runtime",
                description: "Install a runtime (Python, Go, Docker, Rust, Ruby) on a server. Installation is async - monitor progress in Dashboard.",
                inputSchema: {
                    type: "object",
                    properties: {
                        serverId: { type: "string", description: "The server ID (first 12 chars is enough)" },
                        runtime: { type: "string", enum: ["python", "go", "docker", "rust", "ruby"], description: "The runtime to install" },
                        dryRun: { type: "boolean", description: "If true, only simulate the installation" }
                    },
                    required: ["serverId", "runtime"],
                },
            },
            {
                name: "update_runtime",
                description: "Update a runtime to its latest version on a server. Update is async - monitor progress in Dashboard.",
                inputSchema: {
                    type: "object",
                    properties: {
                        serverId: { type: "string", description: "The server ID (first 12 chars is enough)" },
                        runtime: { type: "string", enum: ["nodejs", "python", "go", "docker", "rust", "ruby"], description: "The runtime to update" },
                        dryRun: { type: "boolean", description: "If true, only simulate the update" }
                    },
                    required: ["serverId", "runtime"],
                },
            },
        ],
    };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments || {}) as Record<string, any>;

    switch (request.params.name) {
        case "list_servers": {
            try {
                const response = await cpRequest('get', '/api/internal/servers');
                const servers = response.data.map((s: any) => ({
                    id: s.id,
                    shortId: s.id.slice(0, 12),
                    status: s.status,
                    registeredAt: s.registeredAt
                }));
                return {
                    content: [{ type: "text", text: `Found ${servers.length} server(s):\n${JSON.stringify(servers, null, 2)}` }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }

        case "list_apps": {
            try {
                const response = await cpRequest('get', '/api/apps');
                const apps = response.data.map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    nodeId: a.nodeId?.slice(0, 12),
                    port: a.port,
                    repoUrl: a.repoUrl
                }));
                return {
                    content: [{ type: "text", text: `Found ${apps.length} app(s):\n${JSON.stringify(apps, null, 2)}` }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }

        case "deploy_app": {
            const { appName, commitHash = 'main', dryRun = false } = args;
            try {
                // Find the app
                const appsRes = await cpRequest('get', '/api/apps');
                const app = appsRes.data.find((a: any) =>
                    a.name.toLowerCase() === appName.toLowerCase() ||
                    a.id === appName ||
                    a.id.startsWith(appName)
                );

                if (!app) {
                    return { content: [{ type: "text", text: `App not found: ${appName}` }], isError: true };
                }

                if (dryRun) {
                    return {
                        content: [{ type: "text", text: `[DRY RUN] Would deploy "${app.name}" from ${app.repoUrl} @ ${commitHash}` }],
                    };
                }

                await cpRequest('post', `/api/apps/${app.id}/deploy`, { commitHash });
                return {
                    content: [{ type: "text", text: `Deployment triggered for "${app.name}" @ ${commitHash}` }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }

        case "restart_service": {
            const { serverId, service, dryRun = false } = args;

            if (dryRun) {
                return {
                    content: [{ type: "text", text: `[DRY RUN] Would restart ${service} on server ${serverId}` }],
                };
            }

            // Note: This requires WebSocket, so we return instructions
            return {
                content: [{
                    type: "text",
                    text: `To restart ${service} on ${serverId}, use the Dashboard UI or send a SERVICE_ACTION WebSocket message. MCP cannot directly control services without WebSocket access.`
                }],
            };
        }

        case "app_action": {
            const { appName, action, dryRun = false } = args;
            try {
                const appsRes = await cpRequest('get', '/api/apps');
                const app = appsRes.data.find((a: any) =>
                    a.name.toLowerCase() === appName.toLowerCase() ||
                    a.id === appName
                );

                if (!app) {
                    return { content: [{ type: "text", text: `App not found: ${appName}` }], isError: true };
                }

                if (dryRun) {
                    return {
                        content: [{ type: "text", text: `[DRY RUN] Would ${action} app "${app.name}"` }],
                    };
                }

                await cpRequest('post', `/api/apps/${app.id}/${action}`);
                return {
                    content: [{ type: "text", text: `Action "${action}" triggered for "${app.name}"` }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }

        case "get_activity_logs": {
            const { limit = 20 } = args;
            try {
                const response = await cpRequest('get', '/api/audit/logs');
                const logs = response.data.slice(0, limit).map((l: any) => ({
                    time: new Date(l.timestamp).toISOString(),
                    type: l.type,
                    status: l.status,
                    details: l.details
                }));
                return {
                    content: [{ type: "text", text: `Last ${logs.length} activity logs:\n${JSON.stringify(logs, null, 2)}` }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }

        case "provision_domain": {
            const { serverId, domain, port, dryRun = false } = args;

            if (dryRun) {
                return {
                    content: [{
                        type: "text",
                        text: `[DRY RUN] Would provision domain "${domain}" → localhost:${port} on server ${serverId} with SSL via Certbot`
                    }],
                };
            }

            return {
                content: [{
                    type: "text",
                    text: `Domain provisioning requires WebSocket. Use the Dashboard UI to provision "${domain}" → port ${port} on server ${serverId}.`
                }],
            };
        }

        case "get_server_infrastructure": {
            const { serverId } = args;
            try {
                const response = await cpRequest('get', `/api/internal/servers/${serverId}/infrastructure`);
                return {
                    content: [{
                        type: "text",
                        text: `Infrastructure status request sent to server ${serverId}. ${response.data.message || 'Check Dashboard for results.'}`
                    }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.response?.data?.error || error.message}` }], isError: true };
            }
        }

        case "install_runtime": {
            const { serverId, runtime, dryRun = false } = args;

            if (dryRun) {
                return {
                    content: [{
                        type: "text",
                        text: `[DRY RUN] Would install ${runtime} on server ${serverId}`
                    }],
                };
            }

            try {
                const response = await cpRequest('post', `/api/internal/servers/${serverId}/runtime/install`, { runtime });
                return {
                    content: [{
                        type: "text",
                        text: `✅ ${response.data.message || `Installation of ${runtime} triggered on server ${serverId}. Monitor progress in Dashboard.`}`
                    }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.response?.data?.error || error.message}` }], isError: true };
            }
        }

        case "update_runtime": {
            const { serverId, runtime, dryRun = false } = args;

            if (dryRun) {
                return {
                    content: [{
                        type: "text",
                        text: `[DRY RUN] Would update ${runtime} on server ${serverId}`
                    }],
                };
            }

            try {
                const response = await cpRequest('post', `/api/internal/servers/${serverId}/runtime/update`, { runtime });
                return {
                    content: [{
                        type: "text",
                        text: `✅ ${response.data.message || `Update of ${runtime} triggered on server ${serverId}. Monitor progress in Dashboard.`}`
                    }],
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.response?.data?.error || error.message}` }], isError: true };
            }
        }

        default:
            throw new Error(`Unknown tool: ${request.params.name}`);
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
