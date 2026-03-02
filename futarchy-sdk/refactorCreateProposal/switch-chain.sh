#!/bin/bash

echo ""
echo "========================================"
echo "        FUTARCHY CHAIN SWITCHER"
echo "========================================"
echo ""
echo "Available chains:"
echo "  1 - Ethereum Mainnet"
echo "  100 - Gnosis Chain (default)"
echo ""

read -p "Enter chain ID (1 or 100): " CHAIN_ID

if [ "$CHAIN_ID" = "1" ]; then
    echo ""
    echo "Switched to Ethereum Mainnet"
    echo ""
    echo "Default tokens:"
    echo "  Company: WETH"
    echo "  Currency: USDC"
    echo ""
    echo "Usage: ./cli.js --chain=1 [command] [args]"
elif [ "$CHAIN_ID" = "100" ]; then
    echo ""
    echo "Switched to Gnosis Chain"
    echo ""
    echo "Default tokens:"
    echo "  Company: PNK"
    echo "  Currency: sDAI"
    echo ""
    echo "Usage: ./cli.js --chain=100 [command] [args]"
else
    echo ""
    echo "Invalid chain ID. Please enter 1 or 100"
    exit 1
fi

echo ""
echo "Example commands:"
echo "  node cli.js --chain=$CHAIN_ID create-proposal config.json"
echo "  node cli.js --chain=$CHAIN_ID setup-pools config.json automatic"
echo ""

export CHAIN_ID=$CHAIN_ID
echo "CHAIN_ID environment variable set to $CHAIN_ID"