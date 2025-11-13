#!/usr/bin/env node

// Direct test of MCP server functionality without client/server separation

import chalk from 'chalk';
import { FutarchyMCPServer } from './mcp-futarchy-server.js';

// Mock a simple test
async function testDirect() {
    console.log(chalk.cyan('🧪 Testing MCP Server directly...'));
    
    try {
        // This will fail but will show us if the server can at least be imported
        const server = new FutarchyMCPServer();
        console.log(chalk.green('✅ Server instance created'));
        
        // Try to simulate a tool call directly
        const proposalResult = await server.handleLoadProposal({
            proposalId: '0xaCf939B88647935799C7612809472bB29d5472e7'
        });
        
        console.log(chalk.green('✅ Proposal loaded:'));
        console.log(proposalResult);
        
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
    }
}

testDirect().catch(console.error);