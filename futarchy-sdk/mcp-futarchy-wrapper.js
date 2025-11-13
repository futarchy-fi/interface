#!/usr/bin/env node

// MCP Wrapper that silences all initialization output
// This ensures clean stdio communication with Claude

// Load environment variables FIRST before anything else
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the same directory
dotenv.config({ path: join(__dirname, '.env') });

// Capture and redirect all console output to stderr before any imports
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;

// During initialization, suppress all output
let suppressOutput = true;

console.log = (...args) => {
    if (!suppressOutput) originalLog(...args);
    else console.error(...args);
};
console.info = (...args) => {
    if (!suppressOutput) originalInfo(...args);
    else console.error(...args);
};
console.warn = (...args) => {
    if (!suppressOutput) originalWarn(...args);
    else console.error(...args);
};

// Now import and run the server
import('./mcp-futarchy-server.js').then(module => {
    const { FutarchyMCPServer } = module;
    
    // Create and run server
    const server = new FutarchyMCPServer();
    
    // After initialization, allow normal stdio for MCP protocol
    suppressOutput = false;
    
    server.run().catch(console.error);
}).catch(console.error);