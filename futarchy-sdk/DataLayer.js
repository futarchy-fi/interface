// DataLayer.js - Modular Data Layer with Plugin System

// =============================================================================
// 1. CORE DATA LAYER - Completely Agnostic
// =============================================================================

class DataLayer {
    constructor() {
        this.fetchers = new Map(); // Map of dataPath -> fetcher
        this.executors = new Map(); // Map of dataPath -> executor
        this.channels = new Map(); // Map of channelPath -> channel (realtime streams)
        this.operations = new Map(); // Map of dataPath -> operation function
        console.log(`🏗️  DataLayer initialized (empty - ready for fetchers and executors)`);
    }
    
    // Register a fetcher for specific operations
    registerFetcher(fetcher) {
        console.log(`🔌 Registering ${fetcher.constructor.name} with operations:`, fetcher.supportedOperations);
        
        fetcher.supportedOperations.forEach(operation => {
            this.fetchers.set(operation, fetcher);
            this.operations.set(operation, fetcher.operations[operation]);
        });
        
        console.log(`✅ ${fetcher.constructor.name} registered successfully`);
        return this;
    }
    
    // Register an executor for specific operations
    registerExecutor(executor) {
        console.log(`🔌 Registering ${executor.constructor.name} executor`);
        
        // Get all available operations from executor (including cartridges)
        const operations = executor.getAvailableOperations ? executor.getAvailableOperations() : executor.supportedOperations;
        
        operations.forEach(operation => {
            this.executors.set(operation, executor);
        });
        
        console.log(`✅ ${executor.constructor.name} registered with ${operations.length} operations`);
        return this;
    }

    // Register a realtime channel for specific subscriptions
    registerChannel(channel) {
        console.log(`🔌 Registering ${channel.constructor.name} channel with topics:`, channel.supportedChannels);

        channel.supportedChannels.forEach(topic => {
            this.channels.set(topic, channel);
        });

        console.log(`✅ ${channel.constructor.name} registered successfully`);
        return this;
    }
    
    // Get all registered operations
    getAvailableOperations() {
        const fetcherOps = Array.from(this.fetchers.keys());
        const executorOps = Array.from(this.executors.keys());
        return [...new Set([...fetcherOps, ...executorOps])]; // Remove duplicates
    }
    
    // Main fetch method - routes to appropriate fetcher
    async fetch(dataPath, args = {}) {
        console.log(`🚀 DataLayer.fetch('${dataPath}') called`);
        
        if (!this.fetchers.has(dataPath)) {
            return {
                status: "error",
                reason: `Operation '${dataPath}' not supported`,
                availableOperations: this.getAvailableOperations()
            };
        }
        
        const fetcher = this.fetchers.get(dataPath);
        console.log(`📡 Routing to ${fetcher.constructor.name}`);
        
        return await fetcher.fetch(dataPath, args);
    }
    
    // Main execute method - routes to appropriate executor
    async* execute(dataPath, args = {}) {
        console.log(`🚀 DataLayer.execute('${dataPath}') called`);
        
        if (!this.executors.has(dataPath)) {
            yield {
                status: "error",
                reason: `Operation '${dataPath}' not supported`,
                availableOperations: this.getAvailableOperations()
            };
            return;
        }
        
        const executor = this.executors.get(dataPath);
        console.log(`📡 Routing to ${executor.constructor.name}`);

        yield* executor.execute(dataPath, args);
    }

    // Subscribe to realtime data - routes to appropriate channel
    async* subscribe(channelPath, args = {}) {
        console.log(`🚀 DataLayer.subscribe('${channelPath}') called`);

        if (!this.channels.has(channelPath)) {
            yield {
                status: "error",
                reason: `Channel '${channelPath}' not supported`,
                availableChannels: this.getAvailableChannels()
            };
            return;
        }

        const channel = this.channels.get(channelPath);
        console.log(`📡 Routing subscription to ${channel.constructor.name}`);

        // Delegate to channel’s async generator
        yield* channel.subscribe(channelPath, args);
    }
    
    // Check if operation is supported
    supports(dataPath) {
        return this.fetchers.has(dataPath) || this.executors.has(dataPath);
    }

    // Get all registered channels
    getAvailableChannels() {
        return Array.from(this.channels.keys());
    }
}

// =============================================================================
// 2. BASE FETCHER INTERFACE
// =============================================================================

class BaseFetcher {
    constructor() {
        this.supportedOperations = [];
        this.operations = {};
        if (this.constructor === BaseFetcher) {
            throw new Error("BaseFetcher is abstract and cannot be instantiated");
        }
    }
    
    async fetch(dataPath, args = {}) {
        throw new Error("Subclasses must implement fetch method");
    }
    
    // Helper to register an operation
    registerOperation(operationPath, handlerFunction) {
        this.supportedOperations.push(operationPath);
        this.operations[operationPath] = handlerFunction;
    }
}

// =============================================================================
// 3. BASE CHANNEL INTERFACE
// =============================================================================

class BaseChannel {
    constructor() {
        this.supportedChannels = [];
        this.subscriptions = {};
        if (this.constructor === BaseChannel) {
            throw new Error("BaseChannel is abstract and cannot be instantiated");
        }
    }

    // Async generator – subclasses should implement
    async* subscribe(channelPath, args = {}) {
        throw new Error("Subclasses must implement subscribe(channelPath, args)");
    }

    // Helper to register a channel topic
    registerChannel(channelPath, handlerFunction) {
        this.supportedChannels.push(channelPath);
        this.subscriptions[channelPath] = handlerFunction;
    }
}

// =============================================================================
// 4. EXPORTS - Core System Only
// =============================================================================

export { DataLayer, BaseFetcher, BaseChannel }; 
