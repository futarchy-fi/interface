// BaseExecutor.js - Base class for all transaction executors

/**
 * Base class for all executors (Web3 transaction handlers)
 * Follows the same pattern as BaseFetcher but for blockchain interactions
 */
class BaseExecutor {
    constructor() {
        this.supportedOperations = [];
        this.operations = {};
        this.name = this.constructor.name;
        
        if (this.constructor === BaseExecutor) {
            throw new Error("BaseExecutor is abstract and cannot be instantiated");
        }
        
        console.log(`🔧 ${this.name} initialized`);
    }
    
    /**
     * Execute a blockchain operation
     * @param {string} dataPath - Operation path (e.g., 'web3.approve', 'web3.swap')
     * @param {object} args - Operation arguments
     * @returns {AsyncGenerator} - Yields status updates during execution
     */
    async* execute(dataPath, args = {}) {
        throw new Error("Subclasses must implement execute method");
    }
    
    /**
     * Check if this executor supports a given operation
     * @param {string} dataPath - Operation path to check
     * @returns {boolean}
     */
    supports(dataPath) {
        return this.supportedOperations.includes(dataPath);
    }
    
    /**
     * Helper to register an operation with this executor
     * @param {string} operationPath - The operation path (e.g., 'web3.approve')
     * @param {function} handlerFunction - The function to handle this operation
     */
    registerOperation(operationPath, handlerFunction) {
        this.supportedOperations.push(operationPath);
        this.operations[operationPath] = handlerFunction;
        console.log(`✅ ${this.name} registered operation: ${operationPath}`);
    }
    
    /**
     * Get connection status (should be implemented by subclasses)
     * @returns {object} - Status information
     */
    getStatus() {
        return {
            name: this.name,
            connected: false,
            supportedOperations: this.supportedOperations
        };
    }
}

export { BaseExecutor }; 