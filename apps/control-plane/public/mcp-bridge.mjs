#!/usr/bin/env node
/**
 * ServerFlow MCP Bridge - Lightweight proxy that connects Claude Desktop to ServerFlow
 * Usage: node mcp-bridge.mjs
 *
 * Required env vars:
 *   CONTROL_PLANE_URL - Your ServerFlow URL (e.g., https://serverflow.example.com)
 *   MCP_API_TOKEN - Your MCP token (sf_mcp_xxx)
 */

import { createInterface } from 'readline';

const CP_URL = process.env.CONTROL_PLANE_URL || 'http://localhost:3000';
const TOKEN = process.env.MCP_API_TOKEN || '';

const rl = createInterface({ input: process.stdin });

async function sendToServer(request) {
    try {
        const response = await fetch(`${CP_URL}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(request)
        });
        return await response.json();
    } catch (error) {
        return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32603, message: `Connection error: ${error.message}` }
        };
    }
}

rl.on('line', async (line) => {
    try {
        const request = JSON.parse(line);
        const response = await sendToServer(request);
        console.log(JSON.stringify(response));
    } catch (e) {
        console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' }
        }));
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
