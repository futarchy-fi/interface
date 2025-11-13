#!/usr/bin/env node

// basefetch.js - Direct BaseFetcher Testing CLI
// Allows isolated testing of any fetcher that inherits from BaseFetcher

import { readdir } from 'fs/promises';
import { join } from 'path';
import { BaseFetcher } from './DataLayer.js';
import { config } from './config.js';

// =============================================================================
// FETCHER DISCOVERY SYSTEM
// =============================================================================

class FetcherRegistry {
    constructor() {
        this.fetchers = new Map();
        this.fetcherClasses = new Map();
    }
    
    // Dynamically discover and load all fetchers
    async discoverFetchers() {
        console.log('🔍 Discovering BaseFetcher implementations...');
        
        try {
            const fetcherFiles = await readdir('./fetchers');
            
            for (const file of fetcherFiles) {
                if (file.endsWith('.js')) {
                    try {
                        const modulePath = `./fetchers/${file}`;
                        const module = await import(modulePath);
                        
                        // Check each export to find BaseFetcher implementations
                        for (const [exportName, exportValue] of Object.entries(module)) {
                            if (this.isBaseFetcherClass(exportValue)) {
                                console.log(`✅ Found fetcher: ${exportName} in ${file}`);
                                this.fetcherClasses.set(exportName.toLowerCase(), {
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
            
            console.log(`📦 Discovered ${this.fetcherClasses.size} fetcher implementations`);
            return Array.from(this.fetcherClasses.keys());
        } catch (err) {
            console.error('❌ Error discovering fetchers:', err.message);
            return [];
        }
    }
    
    // Check if a class extends BaseFetcher
    isBaseFetcherClass(cls) {
        if (typeof cls !== 'function') return false;
        
        try {
            // Check prototype chain
            let proto = cls.prototype;
            while (proto && proto !== Object.prototype) {
                if (proto.constructor === BaseFetcher) return true;
                proto = Object.getPrototypeOf(proto);
            }
            return false;
        } catch {
            return false;
        }
    }
    
    // Create an instance of a fetcher by name
    async createFetcher(fetcherName) {
        const fetcherInfo = this.fetcherClasses.get(fetcherName.toLowerCase());
        if (!fetcherInfo) {
            throw new Error(`Fetcher '${fetcherName}' not found`);
        }
        
        console.log(`🔧 Creating ${fetcherInfo.name} instance...`);
        
        // Handle different constructor patterns
        if (fetcherName.toLowerCase().includes('supabase')) {
            // Supabase fetchers need client
            if (fetcherInfo.module.createSupabasePoolFetcher) {
                return fetcherInfo.module.createSupabasePoolFetcher(config.supabaseUrl, config.supabaseKey);
            } else {
                // Direct instantiation with supabase client
                const { createClient } = await import('@supabase/supabase-js');
                const client = createClient(config.supabaseUrl, config.supabaseKey);
                return new fetcherInfo.class(client);
            }
        } else {
            // Simple constructor (like MockFetcher)
            return new fetcherInfo.class();
        }
    }
    
    // Get fetcher info
    getFetcherInfo(fetcherName) {
        return this.fetcherClasses.get(fetcherName.toLowerCase());
    }
    
    // List all available fetchers
    listFetchers() {
        return Array.from(this.fetcherClasses.values());
    }
}

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    
    const params = {
        command: 'help',
        fetcher: null,
        operation: null,
        args: {},
        list: false,
        info: false
    };
    
    // Parse: basefetch <fetcher> <operation> --arg1 value1 --arg2 value2
    // Or: basefetch --list
    // Or: basefetch --info <fetcher>
    
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
                params.fetcher = nextArg;
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
                    if (!params.fetcher) {
                        params.fetcher = arg;
                        params.command = 'test';
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
🚀 BaseFetch CLI - Direct Fetcher Testing Tool

DISCOVER & LIST:
  basefetch --list                     List all available fetchers
  basefetch --info <fetcher>           Show fetcher details and operations

DIRECT TESTING:
  basefetch <fetcher> <operation> [args]    Test specific fetcher operation
  
EXAMPLES:
  # List all fetchers
  basefetch --list
  
  # Get fetcher info
  basefetch --info mockfetcher
  basefetch --info supabasepetcher
  
  # Test MockFetcher operations
  basefetch mockfetcher pools.candle --id 0x123 --limit 5
  basefetch mockfetcher user.profile --userId 0x123
  
  # Test SupabasePoolFetcher operations
  basefetch supabasepetcher pools.candle --id 0xF336F812Db1ad142F22A9A4dd43D40e64B478361 --limit 10
  basefetch supabasepetcher pools.info --id 0xF336F812Db1ad142F22A9A4dd43D40e64B478361
  
COMMON ARGUMENTS:
  --id <address>       Pool or user address
  --limit <number>     Number of records to fetch
  --interval <ms>      Time interval in milliseconds
  --timeframe <time>   Time period (24h, 7d, etc.)
  --userId <address>   User identifier

PURPOSE:
🔬 Isolated testing of individual fetchers
🐛 Debugging fetcher implementations  
⚡ Quick validation without DataLayer overhead
🧪 Development and testing workflows
    `);
}

async function listFetchers(registry) {
    console.log('\n📦 AVAILABLE BASEFETCHER IMPLEMENTATIONS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const fetchers = registry.listFetchers();
    if (fetchers.length === 0) {
        console.log('❌ No BaseFetcher implementations found');
        return;
    }
    
    for (const fetcher of fetchers) {
        console.log(`\n🔧 ${fetcher.name}`);
        console.log(`   📁 File: ${fetcher.file}`);
        
        try {
            const instance = await registry.createFetcher(fetcher.name);
            console.log(`   🛠️  Operations: ${instance.supportedOperations.join(', ')}`);
            console.log(`   ✅ Status: Ready for testing`);
        } catch (err) {
            console.log(`   ❌ Status: Error creating instance - ${err.message}`);
        }
    }
    
    console.log(`\n💡 Use 'basefetch --info <fetcher>' for detailed information`);
    console.log(`💡 Use 'basefetch <fetcher> <operation> [args]' to test directly`);
}

async function showFetcherInfo(registry, fetcherName) {
    console.log(`\n🔍 FETCHER DETAILS: ${fetcherName.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    try {
        const instance = await registry.createFetcher(fetcherName);
        const info = registry.getFetcherInfo(fetcherName);
        
        console.log(`📛 Name: ${info.name}`);
        console.log(`📁 File: ${info.file}`);
        console.log(`🏗️  Type: ${instance.constructor.name}`);
        console.log(`🛠️  Operations: ${instance.supportedOperations.length}`);
        
        console.log(`\n📋 AVAILABLE OPERATIONS:`);
        instance.supportedOperations.forEach((op, index) => {
            console.log(`   ${index + 1}. ${op}`);
        });
        
        console.log(`\n🧪 TESTING EXAMPLES:`);
        instance.supportedOperations.forEach(op => {
            let example = `basefetch ${fetcherName.toLowerCase()} ${op}`;
            
            // Add common arguments based on operation type
            if (op.includes('pool')) {
                example += ' --id 0xF336F812Db1ad142F22A9A4dd43D40e64B478361';
            }
            if (op.includes('candle')) {
                example += ' --limit 10';
            }
            if (op.includes('user')) {
                example += ' --userId 0x123...';
            }
            
            console.log(`   ${example}`);
        });
        
    } catch (err) {
        console.error(`❌ Error getting fetcher info: ${err.message}`);
    }
}

async function testFetcher(registry, fetcherName, operation, args) {
    console.log(`\n🧪 DIRECT FETCHER TEST`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🔧 Fetcher: ${fetcherName}`);
    console.log(`⚡ Operation: ${operation}`);
    console.log(`📝 Arguments:`, JSON.stringify(args, null, 2));
    
    try {
        const startTime = Date.now();
        const instance = await registry.createFetcher(fetcherName);
        
        // Check if operation is supported
        if (!instance.supportedOperations.includes(operation)) {
            console.log(`❌ Operation '${operation}' not supported by ${fetcherName}`);
            console.log(`🛠️  Available operations: ${instance.supportedOperations.join(', ')}`);
            return;
        }
        
        console.log(`\n🚀 Executing ${operation}...`);
        const result = await instance.fetch(operation, args);
        const duration = Date.now() - startTime;
        
        console.log(`\n📊 RESULT (${duration}ms):`);
        console.log('───────────────────────────────────────────────────────────────');
        console.log(JSON.stringify(result, null, 2));
        
        // Summary
        if (result.status === 'success' && result.data) {
            console.log(`\n✅ SUCCESS: ${result.source || fetcherName}`);
            if (Array.isArray(result.data)) {
                console.log(`📈 Records: ${result.data.length}`);
            }
        } else if (result.status === 'error') {
            console.log(`\n❌ ERROR: ${result.reason}`);
        }
        
    } catch (err) {
        console.error(`💥 Test failed: ${err.message}`);
        console.error(err.stack);
    }
}

// =============================================================================
// MAIN CLI HANDLER
// =============================================================================

async function main() {
    const params = parseArgs();
    const registry = new FetcherRegistry();
    
    // Discover all fetchers first
    await registry.discoverFetchers();
    
    switch (params.command) {
        case 'help':
            await showHelp();
            break;
            
        case 'list':
            await listFetchers(registry);
            break;
            
        case 'info':
            if (!params.fetcher) {
                console.error('❌ Fetcher name required for --info');
                process.exit(1);
            }
            await showFetcherInfo(registry, params.fetcher);
            break;
            
        case 'test':
            if (!params.fetcher || !params.operation) {
                console.error('❌ Both fetcher and operation required for testing');
                console.log('Use: basefetch <fetcher> <operation> [args]');
                process.exit(1);
            }
            await testFetcher(registry, params.fetcher, params.operation, params.args);
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