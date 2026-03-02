// OperationRegistry.js - Dynamic Operation Loading and Management

// Import all operation configurations
import { FutarchyMergeOperation } from './FutarchyMergeOperation.js';
import { FutarchySplitSwapOperation } from './FutarchySplitSwapOperation.js';
import { FutarchyRedeemOperation } from './FutarchyRedeemOperation.js';
import { CoWSwapOperation } from './CoWSwapOperation.js';
import { SwaprSwapOperation } from './SwaprSwapOperation.js';

/**
 * Registry for managing operation configurations with dependency injection
 */
class OperationRegistry {
  constructor() {
    this.operations = new Map();
    this.categories = new Map();
    
    // Auto-register default operations
    this.registerDefaults();
  }

  /**
   * Register a new operation configuration
   */
  register(operation) {
    if (!operation.id || !operation.operation) {
      throw new Error('Operation must have id and operation properties');
    }
    
    this.operations.set(operation.id, operation);
    
    // Organize by cartridge for easy categorization
    const cartridge = operation.cartridge || 'uncategorized';
    if (!this.categories.has(cartridge)) {
      this.categories.set(cartridge, []);
    }
    this.categories.get(cartridge).push(operation.id);
    
    console.log(`Registered operation: ${operation.id} (${operation.name})`);
  }

  /**
   * Get operation configuration by ID
   */
  get(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }
    return operation;
  }

  /**
   * Get all operations in a category/cartridge
   */
  getByCategory(cartridge) {
    const operationIds = this.categories.get(cartridge) || [];
    return operationIds.map(id => this.operations.get(id));
  }

  /**
   * Get all available operations
   */
  getAll() {
    return Array.from(this.operations.values());
  }

  /**
   * Get operations grouped by category
   */
  getAllGrouped() {
    const grouped = {};
    for (const [cartridge, operationIds] of this.categories.entries()) {
      grouped[cartridge] = operationIds.map(id => this.operations.get(id));
    }
    return grouped;
  }

  /**
   * Check if operation exists
   */
  has(operationId) {
    return this.operations.has(operationId);
  }

  /**
   * Remove operation
   */
  unregister(operationId) {
    const operation = this.operations.get(operationId);
    if (operation) {
      this.operations.delete(operationId);
      
      // Remove from category
      const cartridge = operation.cartridge || 'uncategorized';
      const categoryOps = this.categories.get(cartridge) || [];
      const index = categoryOps.indexOf(operationId);
      if (index > -1) {
        categoryOps.splice(index, 1);
      }
    }
  }

  /**
   * Register default operations
   */
  registerDefaults() {
    this.register(FutarchyMergeOperation);
    this.register(FutarchySplitSwapOperation);
    this.register(FutarchyRedeemOperation);
    this.register(CoWSwapOperation);
    this.register(SwaprSwapOperation);
  }

  /**
   * Create operation loader with validation
   */
  createLoader(operationId) {
    const operation = this.get(operationId);
    
    return {
      // Basic operation info
      ...operation,
      
      // Enhanced step management
      initializeSteps: () => {
        return operation.steps.map(step => ({
          ...step,
          status: 'pending',
          data: null
        }));
      },

      // Parameter handling with validation
      validateAndTransform: (formParams) => {
        // First validate
        const errors = operation.validateParams ? operation.validateParams(formParams) : null;
        if (errors) {
          return { errors, params: null };
        }
        
        // Then transform
        const params = operation.transformParams ? operation.transformParams(formParams) : formParams;
        return { errors: null, params };
      },

      // Result handling
      processResult: (result) => {
        if (operation.handleResult) {
          return operation.handleResult(result);
        }
        return result;
      },

      // Success message generation
      generateSuccessMessage: (result) => {
        if (operation.getSuccessMessage) {
          return operation.getSuccessMessage(result);
        }
        return `${operation.name} completed successfully!`;
      },

      // Link generation
      generateLink: (identifier) => {
        if (operation.getTransactionLink) {
          return operation.getTransactionLink(identifier);
        }
        return `https://gnosisscan.io/tx/${identifier}`;
      }
    };
  }
}

// Create singleton registry
export const operationRegistry = new OperationRegistry();

/**
 * Hook for React components to access operations
 */
export const useOperationRegistry = () => {
  return {
    getOperation: (id) => operationRegistry.get(id),
    getAllOperations: () => operationRegistry.getAll(),
    getOperationsByCategory: (cartridge) => operationRegistry.getByCategory(cartridge),
    getAllGrouped: () => operationRegistry.getAllGrouped(),
    createLoader: (id) => operationRegistry.createLoader(id),
    hasOperation: (id) => operationRegistry.has(id)
  };
};

/**
 * Register a custom operation at runtime
 */
export const registerOperation = (operation) => {
  operationRegistry.register(operation);
};

/**
 * Helper to create new operation configurations
 */
export const createOperationConfig = ({
  id,
  name,
  description,
  cartridge,
  operation,
  steps,
  stepMapping,
  defaultParams = {},
  parameterSchema = {},
  transformParams = (params) => params,
  validateParams = () => null,
  getSuccessMessage = (result) => `${name} completed successfully!`,
  getTransactionLink = (hash) => `https://gnosisscan.io/tx/${hash}`,
  handleResult = (result) => result
}) => {
  return {
    id,
    name,
    description,
    cartridge,
    operation,
    steps,
    stepMapping,
    defaultParams,
    parameterSchema,
    transformParams,
    validateParams,
    getSuccessMessage,
    getTransactionLink,
    handleResult
  };
};

export default operationRegistry; 