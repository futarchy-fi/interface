#!/bin/bash

echo "=========================================="
echo "FUTARCHY TEST PROPOSAL - MINIMAL LIQUIDITY"
echo "=========================================="
echo ""
echo "This test will create a proposal with extremely small liquidity amounts"
echo "Liquidity per pool: 0.000000000001 tokens"
echo ""
echo "Market: Will AI improve governance decisions by 50% before 2026?"
echo "Event Probability: 65%"
echo "Expected Impact: 15%"
echo ""
echo "Pool Calculations:"
echo "1. YES-PNK/sDAI: Price = 0.02173 * 1.15 * 0.65 = 0.01624"
echo "2. NO-PNK/sDAI:  Price = 0.02173 * (1 - 0.65*0.15) = 0.01961"
echo "3. YES-sDAI/sDAI: Price = 0.65"
echo "4. NO-sDAI/sDAI:  Price = 0.35"
echo "5. YES-PNK/NO-PNK: Ratio = 0.65/0.35 = 1.857"
echo "6. YES-sDAI/NO-sDAI: Ratio = 0.65/0.35 = 1.857"
echo ""
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and add your private key"
    exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Starting test proposal setup..."
echo ""

# Run the setup in automatic mode
node cli.js setup-auto config/test-proposal.config.json

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "Check logs/ directory for transaction details"
echo "=========================================="