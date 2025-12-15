
export interface ExecutorServices {
    rpc: any; // PublicClient
    wallet: any; // WalletClient
    signer?: { account: string };
    chainId?: number;
    logger?: Console;
}

export interface Cartridge {
    install(executor: Executor): Promise<void>;
}

export class Executor {
    services: ExecutorServices;
    registry: Record<string, Function>;
    plugins: Cartridge[];

    constructor(services: ExecutorServices) {
        this.services = services;
        this.registry = Object.create(null);
        this.plugins = [];
    }

    async install(plugin: Cartridge) {
        await plugin.install(this);
        this.plugins.push(plugin);
    }

    registerCommand(name: string, fn: Function, meta: any = {}) {
        if (this.registry[name]) {
            console.warn(`[Executor] Warning: Overwriting command ${name}`);
        }
        this.registry[name] = Object.assign(fn, { meta });
        this.services.logger?.log(`[Executor] Registered: ${name}`);
    }

    async run(name: string, args: any = {}) {
        const cmd = this.registry[name];
        if (!cmd) throw new Error(`Unknown command: ${name}`);

        try {
            return await cmd(args, this.services);
        } catch (error) {
            this.services.logger?.error(`[Executor] Error in ${name}:`, error);
            throw error;
        }
    }
}
