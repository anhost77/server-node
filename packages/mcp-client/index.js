#!/usr/bin/env node
/**
 * ServerFlow MCP Client
 * Connects Claude Desktop to your ServerFlow infrastructure
 *
 * Environment variables:
 *   SERVERFLOW_API_KEY - Your MCP token (sf_mcp_xxx)
 *   SERVERFLOW_URL - Your ServerFlow URL (default: https://serverflow.io)
 */

import { createInterface } from 'readline';

const API_URL = process.env.SERVERFLOW_URL || 'https://serverflow.io';
const API_KEY = process.env.SERVERFLOW_API_KEY || '';

if (!API_KEY) {
    console.error(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'SERVERFLOW_API_KEY environment variable is required' }
    }));
    process.exit(1);
}

const rl = createInterface({ input: process.stdin });

async function sendRequest(request) {
    try {
        const response = await fetch(`${API_URL}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(request)
        });

        // Notifications return 204 No Content
        if (response.status === 204) {
            return null; // No response needed for notifications
        }

        if (!response.ok) {
            const text = await response.text();
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32603, message: `HTTP ${response.status}: ${text}` }
            };
        }

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
    if (!line.trim()) return;

    try {
        const request = JSON.parse(line);
        const response = await sendRequest(request);
        // Only output response if we got one (notifications return null)
        if (response !== null) {
            console.log(JSON.stringify(response));
        }
    } catch (e) {
        console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' }
        }));
    }
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
