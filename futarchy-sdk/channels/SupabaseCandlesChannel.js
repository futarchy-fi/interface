// channels/SupabaseCandlesChannel.js - Supabase realtime channel for pool candles

import { createClient } from '@supabase/supabase-js';
import { BaseChannel } from '../DataLayer.js';
import { config } from '../config.js';

// Topic name follows dot-notation without clashing with fetcher ops
// e.g. 'pools.candle.realtime'
const CANDLES_TOPIC = 'pools.candle.realtime';

/**
 * SupabaseCandlesChannel
 * Streams realtime INSERTs from the `pool_candles` table filtered by address/interval
 * Yields standardized payloads suitable for UI or CLI consumers.
 */
class SupabaseCandlesChannel extends BaseChannel {
    constructor(supabaseClient) {
        super();
        this.name = 'SupabaseCandlesChannel';
        this.supabase = supabaseClient;
        this.registerChannel(CANDLES_TOPIC, this._subscribeCandles.bind(this));
        console.log(`🔧 ${this.name} ready (topic: ${CANDLES_TOPIC})`);
    }

    async* subscribe(channelPath, args = {}) {
        if (!(channelPath in this.subscriptions)) {
            yield {
                status: 'error',
                reason: `Channel '${channelPath}' not supported by ${this.name}`,
                supportedChannels: this.supportedChannels
            };
            return;
        }
        yield* this.subscriptions[channelPath](args);
    }

    // Internal: subscribe and yield incoming rows
    async* _subscribeCandles(args = {}) {
        const { id, interval = config.intervals['1h'] } = args;

        if (!id) {
            yield { status: 'error', reason: "Missing required arg 'id' (pool address)" };
            return;
        }

        // Simple async queue to bridge callback → async generator
        const queue = [];
        let resolver = null;
        let active = true;

        const push = (item) => {
            if (resolver) {
                const r = resolver;
                resolver = null;
                r(item);
            } else {
                queue.push(item);
            }
        };

        // Build realtime channel
        const channelName = `pool_candles:address=${id}:interval=${interval}`;
        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'pool_candles',
                    filter: `address=eq.${id}`
                },
                (payload) => {
                    const row = payload?.new || {};
                    if (row.interval !== interval) return; // filter by interval client-side
                    push({
                        status: 'pending',
                        step: 'update',
                        message: 'New candle received',
                        data: {
                            address: row.address,
                            interval: row.interval,
                            timestamp: row.timestamp,
                            price: row.price
                        },
                        source: this.name
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    push({ status: 'success', step: 'subscribed', message: 'Subscribed to pool_candles', data: { id, interval }, source: this.name });
                } else if (status === 'CHANNEL_ERROR') {
                    push({ status: 'error', step: 'error', message: 'Channel error', data: { id, interval }, source: this.name });
                } else if (status === 'TIMED_OUT') {
                    push({ status: 'error', step: 'timeout', message: 'Channel timed out', data: { id, interval }, source: this.name });
                } else if (status === 'CLOSED') {
                    push({ status: 'success', step: 'closed', message: 'Channel closed', data: { id, interval }, source: this.name });
                }
            });

        try {
            // Drain the queue as an async generator
            while (active) {
                if (queue.length > 0) {
                    yield queue.shift();
                } else {
                    const next = await new Promise((resolve) => (resolver = resolve));
                    yield next;
                }
            }
        } finally {
            // Cleanup on cancellation
            active = false;
            try { await this.supabase.removeChannel(channel); } catch {}
        }
    }
}

export function createSupabaseCandlesChannel(supabaseUrl = config.supabaseUrl, supabaseKey = config.supabaseKey) {
    const client = createClient(supabaseUrl, supabaseKey);
    return new SupabaseCandlesChannel(client);
}

export { SupabaseCandlesChannel, CANDLES_TOPIC };

