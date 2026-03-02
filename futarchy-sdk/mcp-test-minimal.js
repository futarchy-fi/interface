#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
    ListToolsRequestSchema,
    CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

// Suppress all console.log to stderr
console.log = console.error;

const server = new Server(
    {
        name: "futarchy-test",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'test',
            description: 'Test tool',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        }
    ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return {
        content: [
            {
                type: 'text',
                text: 'Test response'
            }
        ]
    };
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Minimal MCP Server running...');
}

run().catch(console.error);