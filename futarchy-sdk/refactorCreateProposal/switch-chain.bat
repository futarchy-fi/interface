@echo off
echo.
echo ========================================
echo        FUTARCHY CHAIN SWITCHER
echo ========================================
echo.
echo Available chains:
echo   1 - Ethereum Mainnet
echo   100 - Gnosis Chain (default)
echo.

set /p CHAIN_ID="Enter chain ID (1 or 100): "

if "%CHAIN_ID%"=="1" (
    echo.
    echo Switched to Ethereum Mainnet
    echo.
    echo Default tokens:
    echo   Company: WETH
    echo   Currency: USDC
    echo.
    echo Usage: cli.js --chain=1 [command] [args]
) else if "%CHAIN_ID%"=="100" (
    echo.
    echo Switched to Gnosis Chain
    echo.
    echo Default tokens:
    echo   Company: PNK
    echo   Currency: sDAI
    echo.
    echo Usage: cli.js --chain=100 [command] [args]
) else (
    echo.
    echo Invalid chain ID. Please enter 1 or 100
    exit /b 1
)

echo.
echo Example commands:
echo   node cli.js --chain=%CHAIN_ID% create-proposal config.json
echo   node cli.js --chain=%CHAIN_ID% setup-pools config.json automatic
echo.