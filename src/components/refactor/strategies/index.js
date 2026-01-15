// Export all strategies for clean imports
export { BaseRealtimeStrategy } from './BaseRealtimeStrategy';
export { TradeHistoryRealtimeStrategy } from './TradeHistoryRealtimeStrategy';
export { PoolCandlesRealtimeStrategy } from './PoolCandlesRealtimeStrategy';

// Re-export existing swap strategies if they exist
export * from './BaseSwapStrategy';
export * from './AlgebraSwapStrategy';
export * from './CowSwapStrategy';
export * from './SwapStrategyFactory';
export * from './SwapExecutor';

// Re-export strategy constants
export const SWAP_STRATEGIES = {
  ALGEBRA: 'algebra',
  COW_SWAP: 'cowswap',
  SUSHI_V3: 'sushiswap'
}; 