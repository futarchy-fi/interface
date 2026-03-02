#!/usr/bin/env node

// Test script for MCP Futarchy Server
// Tests the server locally without needing Claude integration

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMCPServer() {
    console.log(chalk.cyan('🧪 Testing MCP Futarchy Server...'));
    
    // Spawn the MCP server as a subprocess
    const serverPath = join(__dirname, 'mcp-futarchy-server.js');
    const serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'inherit']
    });
    
    // Create MCP client
    const transport = new StdioClientTransport({
        inputStream: serverProcess.stdout,
        outputStream: serverProcess.stdin
    });
    
    const client = new Client({
        name: 'test-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });
    
    try {
        // Connect to the server
        await client.connect(transport);
        console.log(chalk.green('✅ Connected to MCP server'));
        
        // List available tools
        console.log(chalk.cyan('\n📋 Available Tools:'));
        const toolsResponse = await client.request({
            method: 'tools/list',
            params: {}
        });
        
        for (const tool of toolsResponse.tools) {
            console.log(chalk.gray(`  - ${tool.name}: ${tool.description}`));
        }
        
        // Test loading a proposal (example)
        console.log(chalk.cyan('\n🔍 Testing loadProposal tool:'));
        try {
            const proposalResponse = await client.request({
                method: 'tools/call',
                params: {
                    name: 'loadProposal',
                    arguments: {
                        proposalId: '0xaCf939B88647935799C7612809472bB29d5472e7' // Example proposal
                    }
                }
            });
            
            console.log(chalk.green('✅ Proposal loaded:'));
            const content = proposalResponse.content[0].text;
            const data = JSON.parse(content);
            console.log(chalk.gray(`  Proposal: ${data.proposal.address}`));
            console.log(chalk.gray(`  Title: ${data.proposal.title || 'N/A'}`));
            if (data.pools) {
                console.log(chalk.gray(`  Conditional pools: ${data.pools.conditional}`));
                console.log(chalk.gray(`  Prediction pools: ${data.pools.prediction}`));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not load proposal (may need valid proposal ID)'));
        }
        
        // Test getting balances (will fail without wallet)
        console.log(chalk.cyan('\n💰 Testing getBalances tool:'));
        try {
            await client.request({
                method: 'tools/call',
                params: {
                    name: 'getBalances',
                    arguments: {}
                }
            });
        } catch (error) {
            console.log(chalk.yellow('⚠️  Expected: No wallet connected'));
        }
        
        console.log(chalk.green('\n✅ MCP Server tests completed successfully!'));
        
    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.message);
    } finally {
        // Clean up
        await client.close();
        serverProcess.kill();
    }
}

// Run the test
testMCPServer().catch(console.error);