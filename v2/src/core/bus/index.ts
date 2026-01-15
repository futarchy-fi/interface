import mitt from 'mitt';
import { create } from 'zustand';

// 1. Define the Global Event Schema (The "Protocol")
// This is the ONLY place where widgets "know" about each other's existence (conceptually).
// Add new event types here as the app grows.
export type AppEvents = {
  // Company Domain
  'company:selected': { companyId: string; companyName: string };

  // Market Domain
  'market:trade:executed': { symbol: string; amount: number; side: 'buy' | 'sell' };

  // UI Domain
  'ui:notification:show': { type: 'success' | 'error' | 'info'; message: string };

  // Transaction Domain
  'market:transaction:open': {
    mode: 'SWAP' | 'SPLIT' | 'MERGE';
    amount: string;
    payToken: string;
    side: string;
    splitAmount: number;
    exactOutput?: boolean;
    userAddress?: string; // Optional context
  };
};

// 2. Create the Emitter Instance
const emitter = mitt<AppEvents>();

// 3. Create the Hook Store (for React Components)
// This pattern allows us to inject the bus into components easily.
interface EventBusState {
  emit: <Key extends keyof AppEvents>(type: Key, payload: AppEvents[Key]) => void;
  // We expose a helper to subscribe inside useEffects automatically? 
  // For now, raw access to 'on' and 'off' is sufficient for power users.
  on: <Key extends keyof AppEvents>(type: Key, handler: (payload: AppEvents[Key]) => void) => void;
  off: <Key extends keyof AppEvents>(type: Key, handler: (payload: AppEvents[Key]) => void) => void;
}

export const useEventBus = create<EventBusState>(() => ({
  emit: (type, payload) => {
    console.log(`[EventBus] 📢 ${type}`, payload); // Logger for Debugging
    emitter.emit(type, payload);
  },
  on: (type, handler) => emitter.on(type, handler),
  off: (type, handler) => emitter.off(type, handler),
}));

// 4. Non-React Access (for pure logic/adapters)
export const globalBus = {
  emit: <Key extends keyof AppEvents>(type: Key, payload: AppEvents[Key]) => emitter.emit(type, payload),
};
