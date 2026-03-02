// BaseExecutor.js - Base class for all transaction executors

export class BaseExecutor {
    constructor() {
        this.supportedOperations = [];
        this.operations = {};
        this.name = this.constructor.name;

        if (this.constructor === BaseExecutor) {
            throw new Error("BaseExecutor is abstract and cannot be instantiated");
        }

        console.log(`🔧 ${this.name} initialized`);
    }

    async* execute(dataPath, args = {}) {
        throw new Error("Subclasses must implement execute method");
    }

    supports(dataPath) {
        return this.supportedOperations.includes(dataPath);
    }

    registerOperation(operationPath, handlerFunction) {
        this.supportedOperations.push(operationPath);
        this.operations[operationPath] = handlerFunction;
        console.log(`✅ ${this.name} registered operation: ${operationPath}`);
    }

    getStatus() {
        return {
            name: this.name,
            connected: false,
            supportedOperations: this.supportedOperations
        };
    }
}
