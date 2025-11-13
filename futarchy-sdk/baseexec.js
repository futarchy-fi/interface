#!/usr/bin/env node

// baseexec.js - Direct BaseExecutor Testing CLI
// Allows isolated testing of any executor that inherits from BaseExecutor

import { readdir } from 'fs/promises';
import { join } from 'path';
import { BaseExecutor } from './executors/BaseExecutor.js';
import { config } from './config.js';

// =============================================================================
// EXECUTOR DISCOVERY SYSTEM
// =============================================================================

class ExecutorRegistry {
    constructor() {
        this.executors = new Map();
        this.executorClasses = new Map();
    }
    
    // Dynamically discover and load all executors
    async discoverExecutors() {
        console.log('🔍 Discovering BaseExecutor implementations...');
        
        try {
            const executorFiles = await readdir('./executors');
            
            for (const file of executorFiles) {
                if (file.endsWith('.js') && file !== 'BaseExecutor.js') {
                    try {
                        const modulePath = `./executors/${file}`;
                        const module = await import(modulePath);
                        
                        // Check each export to find BaseExecutor implementations
                        for (const [exportName, exportValue] of Object.entries(module)) {
                            if (this.isBaseExecutorClass(exportValue)) {
                                console.log(`✅ Found executor: ${exportName} in ${file}`);
                                this.executorClasses.set(exportName.toLowerCase(), {
                                    name: exportName,
                                    class: exportValue,
                                    file: file,
                                    module: module
                                });
                            }
                        }
                    } catch (err) {
                        console.log(`⚠️  Skipped ${file}: ${err.message}`);
                    }
                }
            }
            
            console.log(`📦 Discovered ${this.executorClasses.size} executor implementations`);
            return Array.from(this.executorClasses.keys());
        } catch (err) {
            console.error('❌ Error discovering executors:', err.message);
            return [];
        }
    }
    
    // Check if a class extends BaseExecutor
    isBaseExecutorClass(cls) {
        if (typeof cls !== 'function') return false;
        
        try {
            // Check prototype chain
            let proto = cls.prototype;
            while (proto && proto !== Object.prototype) {
                if (proto.constructor === BaseExecutor) return true;
                proto = Object.getPrototypeOf(proto);
            }
            return false;
        } catch {
            return false;
        }
    }
    
    // Create an instance of an executor by name
    async createExecutor(executorName, options = {}) {
        const executorInfo = this.executorClasses.get(executorName.toLowerCase());
        if (!executorInfo) {
            throw new Error(`Executor '${executorName}' not found`);
        }
        
        console.log(`🔧 Creating ${executorInfo.name} instance...`);
        
        // Handle different constructor patterns
        if (executorName.toLowerCase().includes('viem')) {
            return new executorInfo.class(options);
        } else if (executorName.toLowerCase().includes('ethers')) {
            // Future: handle ethers executor
            return new executorInfo.class(options);
        } else {
            // Generic constructor
            return new executorInfo.class(options);
        }
    }
    
    // Get executor info
    getExecutorInfo(executorName) {
        return this.executorClasses.get(executorName.toLowerCase());
    }
    
    // List all available executors
    listExecutors() {
        return Array.from(this.executorClasses.values());
    }
}

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    
    const params = {
        command: 'help',
        executor: null,
        operation: null,
        args: {},
        list: false,
        info: false,
        test: false
    };
    
    // Parse: baseexec <executor> <operation> --arg1 value1 --arg2 value2
    // Or: baseexec --list
    // Or: baseexec --info <executor>
    // Or: baseexec --test <executor>
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        
        switch (arg) {
            case '--list':
            case '-l':
                params.command = 'list';
                break;
            case '--info':
            case '-i':
                params.command = 'info';
                params.executor = nextArg;
                i++;
                break;
            case '--test':
            case '-t':
                params.command = 'test';
                params.executor = nextArg;
                i++;
                break;
            case '--help':
            case '-h':
                params.command = 'help';
                break;
            default:
                if (arg.startsWith('--')) {
                    // Argument for operation
                    const key = arg.slice(2);
                    params.args[key] = nextArg || true;
                    if (nextArg && !nextArg.startsWith('--')) i++;
                } else {
                    // Positional arguments
                    if (!params.executor) {
                        params.executor = arg;
                        params.command = 'execute';
                    } else if (!params.operation) {
                        params.operation = arg;
                    }
                }
                break;
        }
    }
    
    return params;
}

// =============================================================================
// CLI COMMANDS
// =============================================================================

async function showHelp() {
    console.log(`
🚀 BaseExec CLI - Direct Executor Testing Tool

DISCOVER & LIST:
  baseexec --list                     List all available executors
  baseexec --info <executor>          Show executor details and operations
  baseexec --test <executor>          Run connection tests

DIRECT TESTING:
  baseexec <executor> <operation> [args]    Execute specific operation
  
EXAMPLES:
  # List all executors
  baseexec --list
  
  # Get executor info
  baseexec --info viemexecutor
  
  # Test executor connection
  baseexec --test viemexecutor
  
  # Execute operations (requires browser/wallet for web3 operations)
  baseexec viemexecutor web3.connect
  baseexec viemexecutor web3.getBalance --tokenAddress 0x... --userAddress 0x...
  baseexec viemexecutor web3.approve --tokenAddress 0x... --spenderAddress 0x... --amount 1000000000000000000
  
COMMON ARGUMENTS:
  --tokenAddress <address>     Token contract address
  --spenderAddress <address>   Spender contract address  
  --userAddress <address>      User wallet address
  --amount <amount>            Amount in wei or token units
  --chain <chainId>            Chain ID (default: 100 for Gnosis)

PURPOSE:
🔬 Isolated testing of individual executors
🐛 Debugging executor implementations  
⚡ Quick validation without DataLayer overhead
🧪 Development and testing workflows

NOTE: Web3 operations require a browser environment with injected wallet.
For Node.js testing, use --test flag to check executor setup only.
    `);
}

async function listExecutors(registry) {
    console.log('\n📦 AVAILABLE BASEEXECUTOR IMPLEMENTATIONS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const executors = registry.listExecutors();
    if (executors.length === 0) {
        console.log('❌ No BaseExecutor implementations found');
        return;
    }
    
    for (const executor of executors) {
        console.log(`\n🔧 ${executor.name}`);
        console.log(`   📁 File: ${executor.file}`);
        
        try {
            const instance = await registry.createExecutor(executor.name);
            console.log(`   🛠️  Operations: ${instance.supportedOperations.join(', ')}`);
            console.log(`   ✅ Status: Ready for testing`);
        } catch (err) {
            console.log(`   ❌ Status: Error creating instance - ${err.message}`);
        }
    }
    
    console.log(`\n💡 Use 'baseexec --info <executor>' for detailed information`);
    console.log(`💡 Use 'baseexec --test <executor>' for connection tests`);
    console.log(`💡 Use 'baseexec <executor> <operation> [args]' to execute operations`);
}

async function showExecutorInfo(registry, executorName) {
    console.log(`\n🔍 EXECUTOR DETAILS: ${executorName.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    try {
        const instance = await registry.createExecutor(executorName);
        const info = registry.getExecutorInfo(executorName);
        
        console.log(`📛 Name: ${info.name}`);
        console.log(`📁 File: ${info.file}`);
        console.log(`🏗️  Type: ${instance.constructor.name}`);
        console.log(`🛠️  Operations: ${instance.supportedOperations.length}`);
        
        // Get status
        const status = instance.getStatus();
        console.log(`🔗 Connected: ${status.connected ? '✅' : '❌'}`);
        
        if (status.chain) {
            console.log(`⛓️  Chain: ${status.chain}`);
        }
        if (status.account) {
            console.log(`👤 Account: ${status.account}`);
        }
        
        console.log(`\n📋 AVAILABLE OPERATIONS:`);
        instance.supportedOperations.forEach((op, index) => {
            console.log(`   ${index + 1}. ${op}`);
        });
        
        console.log(`\n🧪 TESTING EXAMPLES:`);
        console.log(`   # Connection test`);
        console.log(`   baseexec --test ${executorName.toLowerCase()}`);
        console.log(`   `);
        instance.supportedOperations.forEach(op => {
            let example = `   baseexec ${executorName.toLowerCase()} ${op}`;
            
            // Add common arguments based on operation type
            if (op.includes('approve')) {
                example += ' --tokenAddress 0xToken... --spenderAddress 0xSpender... --amount 1000000000000000000';
            } else if (op.includes('getBalance')) {
                example += ' --tokenAddress 0xToken... --userAddress 0xUser...';
            } else if (op.includes('transfer')) {
                example += ' --tokenAddress 0xToken... --to 0xRecipient... --amount 1000000000000000000';
            }
            
            console.log(example);
        });
        
    } catch (err) {
        console.error(`❌ Error getting executor info: ${err.message}`);
    }
}

async function testExecutor(registry, executorName) {
    console.log(`\n🧪 EXECUTOR CONNECTION TEST`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🔧 Executor: ${executorName}`);
    
    try {
        const instance = await registry.createExecutor(executorName);
        const status = instance.getStatus();
        
        console.log(`\n📊 STATUS:`);
        console.log(`   📛 Name: ${status.name}`);
        console.log(`   🔗 Connected: ${status.connected ? '✅ Yes' : '❌ No'}`);
        console.log(`   🛠️  Operations: ${status.supportedOperations.length}`);
        
        if (status.chain) {
            console.log(`   ⛓️  Chain: ${status.chain}`);
        }
        if (status.rpcUrl) {
            console.log(`   🌐 RPC: ${status.rpcUrl}`);
        }
        if (status.account) {
            console.log(`   👤 Account: ${status.account}`);
        }
        
        console.log(`\n✅ Executor instance created successfully!`);
        console.log(`💡 For Web3 operations, use a browser environment with wallet`);
        
    } catch (err) {
        console.error(`💥 Test failed: ${err.message}`);
    }
}

async function executeOperation(registry, executorName, operation, args) {
    console.log(`\n🧪 DIRECT EXECUTOR TEST`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🔧 Executor: ${executorName}`);
    console.log(`⚡ Operation: ${operation}`);
    console.log(`📝 Arguments:`, JSON.stringify(args, null, 2));
    
    try {
        const startTime = Date.now();
        const instance = await registry.createExecutor(executorName);
        
        // Check if operation is supported
        if (!instance.supportedOperations.includes(operation)) {
            console.log(`❌ Operation '${operation}' not supported by ${executorName}`);
            console.log(`🛠️  Available operations: ${instance.supportedOperations.join(', ')}`);
            return;
        }
        
        console.log(`\n🚀 Executing ${operation}...`);
        console.log(`⚠️  Note: This requires browser environment for Web3 operations`);
        
        // For Node.js environment, just show what would be executed
        console.log(`\n📋 EXECUTION PLAN:`);
        console.log(`   Operation: ${operation}`);
        console.log(`   Arguments: ${JSON.stringify(args)}`);
        console.log(`   Executor: ${instance.constructor.name}`);
        
        const duration = Date.now() - startTime;
        console.log(`\n⏱️  Setup completed in ${duration}ms`);
        
        console.log(`\n💡 To execute this operation:`);
        console.log(`   1. Open the web interface: http://localhost:58561`);
        console.log(`   2. Or use the HTML test page with wallet connection`);
        console.log(`   3. This operation would execute: ${operation} with provided args`);
        
    } catch (err) {
        console.error(`💥 Execution failed: ${err.message}`);
    }
}

// =============================================================================
// MAIN CLI HANDLER
// =============================================================================

async function main() {
    const params = parseArgs();
    const registry = new ExecutorRegistry();
    
    // Discover all executors first
    await registry.discoverExecutors();
    
    switch (params.command) {
        case 'help':
            await showHelp();
            break;
            
        case 'list':
            await listExecutors(registry);
            break;
            
        case 'info':
            if (!params.executor) {
                console.error('❌ Executor name required for --info');
                process.exit(1);
            }
            await showExecutorInfo(registry, params.executor);
            break;
            
        case 'test':
            if (!params.executor) {
                console.error('❌ Executor name required for --test');
                process.exit(1);
            }
            await testExecutor(registry, params.executor);
            break;
            
        case 'execute':
            if (!params.executor || !params.operation) {
                console.error('❌ Both executor and operation required for execution');
                console.log('Use: baseexec <executor> <operation> [args]');
                process.exit(1);
            }
            await executeOperation(registry, params.executor, params.operation, params.args);
            break;
            
        default:
            await showHelp();
    }
}

// Run CLI
main().catch(err => {
    console.error('💥 CLI Error:', err.message);
    process.exit(1);
}); 