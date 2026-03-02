/**
 * Preset configurations for multihop spot price calculations
 */

const PRESETS = {
    // GNO → WXDAI → USDC → sDAI
    GNO_SDAI: {
        name: 'GNO/sDAI',
        description: 'GNO to sDAI via WXDAI and USDC',
        hops: [
            {
                name: 'GNO/WXDAI',
                poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
                tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',
                tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
            },
            {
                name: 'WXDAI/USDC',
                poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
                tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
                tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
            },
            {
                name: 'USDC/sDAI',
                poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066',
                tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
                tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
            }
        ]
    }
};

const TOKENS = {
    '0x9c58bacc331c9aa871afd802db6379a98e80cedb': { symbol: 'GNO', decimals: 18 },
    '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d': { symbol: 'WXDAI', decimals: 18 },
    '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83': { symbol: 'USDC', decimals: 6 },
    '0xaf204776c7245bf4147c2612bf6e5972ee483701': { symbol: 'sDAI', decimals: 18 },
};

module.exports = { PRESETS, TOKENS };
