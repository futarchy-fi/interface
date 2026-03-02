    async swapTokens() {
        if (!this.isConnected) {
            console.log(chalk.red('❌ Wallet not connected'));
            return;
        }
        
        const spinner = ora('Loading balances...').start();
        
        try {
            // Get all token balances
            const [companyBalance, currencyBalance] = await Promise.all([
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                })
            ]);
            
            // Get conditional token balances
            const conditionalBalances = await Promise.all(
                this.proposal.wrapped.wrappedOutcomes.map(async (outcome) => {
                    const balance = await this.publicClient.readContract({
                        address: outcome.wrapped1155,
                        abi: [{
                            name: 'balanceOf',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ name: '', type: 'uint256' }]
                        }],
                        functionName: 'balanceOf',
                        args: [this.account.address]
                    }).catch(() => 0n);
                    
                    return { label: outcome.label, balance };
                })
            );
            
            spinner.stop();
            
            // Show conditional pool prices
            console.log('\n' + chalk.cyan('💱 Conditional Pool Swap'));
            console.log(chalk.gray('Trade between YES_COMPANY and YES_CURRENCY (or NO pairs)\n'));
            
            // Find conditional pools
            const yesPool = this.pools.conditionalPools.find(p => p.name === 'YES_COMPANY/YES_CURRENCY');
            const noPool = this.pools.conditionalPools.find(p => p.name === 'NO_COMPANY/NO_CURRENCY');
            
            if (yesPool) {
                const price = this.prices['YES_COMPANY/YES_CURRENCY'];
                const yesCompanyIsToken0 = price.token0.toLowerCase() === this.tokens.yesCompany.toLowerCase();
                const rate = yesCompanyIsToken0 ? price.price : price.priceInverse;
                console.log(chalk.green(`YES Pool: 1 YES_COMPANY = ${rate.toFixed(4)} YES_CURRENCY`));
            }
            
            if (noPool) {
                const price = this.prices['NO_COMPANY/NO_CURRENCY'];
                const noCompanyIsToken0 = price.token0.toLowerCase() === this.tokens.noCompany.toLowerCase();
                const rate = noCompanyIsToken0 ? price.price : price.priceInverse;
                console.log(chalk.red(`NO Pool: 1 NO_COMPANY = ${rate.toFixed(4)} NO_CURRENCY`));
            }
            
            const { outcome, side, amount } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'outcome',
                    message: 'Which outcome to trade?',
                    choices: [
                        { name: chalk.green('YES (believe proposal will pass)'), value: 'YES' },
                        { name: chalk.red('NO (believe proposal will fail)'), value: 'NO' }
                    ]
                },
                {
                    type: 'list',
                    name: 'side',
                    message: 'Trade direction?',
                    choices: [
                        { name: '📈 BUY Company tokens (swap Currency → Company)', value: 'BUY' },
                        { name: '📉 SELL Company tokens (swap Company → Currency)', value: 'SELL' }
                    ]
                },
                {
                    type: 'input',
                    name: 'amount',
                    message: (answers) => {
                        // Calculate available balance
                        const isYes = answers.outcome === 'YES';
                        const isBuy = answers.side === 'BUY';
                        
                        if (isBuy) {
                            // Buying company with currency
                            const currencyToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                            const existing = conditionalBalances.find(b => b.label === currencyToken)?.balance || 0n;
                            const splittable = currencyBalance;
                            const total = existing + splittable;
                            
                            return `Amount of ${currencyToken} to swap (available: ${formatEther(existing)} + ${formatEther(splittable)} splittable = ${formatEther(total)} total):`;
                        } else {
                            // Selling company for currency
                            const companyToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                            const existing = conditionalBalances.find(b => b.label === companyToken)?.balance || 0n;
                            const splittable = companyBalance;
                            const total = existing + splittable;
                            
                            return `Amount of ${companyToken} to swap (available: ${formatEther(existing)} + ${formatEther(splittable)} splittable = ${formatEther(total)} total):`;
                        }
                    },
                    default: '0.01',
                    validate: (input, answers) => {
                        const num = parseFloat(input);
                        if (num <= 0) return 'Please enter a positive amount';
                        
                        // Check total available balance
                        const isYes = answers.outcome === 'YES';
                        const isBuy = answers.side === 'BUY';
                        
                        if (isBuy) {
                            const currencyToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                            const existing = conditionalBalances.find(b => b.label === currencyToken)?.balance || 0n;
                            const total = existing + currencyBalance;
                            if (parseEther(input) > total) return 'Amount exceeds available balance';
                        } else {
                            const companyToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                            const existing = conditionalBalances.find(b => b.label === companyToken)?.balance || 0n;
                            const total = existing + companyBalance;
                            if (parseEther(input) > total) return 'Amount exceeds available balance';
                        }
                        
                        return true;
                    }
                }
            ]);
            
            // Setup swap parameters
            const isYes = outcome === 'YES';
            const isBuy = side === 'BUY';
            const amountWei = parseEther(amount);
            
            // Get wrapped token addresses
            const tokenInLabel = isBuy ? 
                (isYes ? 'YES_CURRENCY' : 'NO_CURRENCY') : 
                (isYes ? 'YES_COMPANY' : 'NO_COMPANY');
            const tokenOutLabel = isBuy ?
                (isYes ? 'YES_COMPANY' : 'NO_COMPANY') :
                (isYes ? 'YES_CURRENCY' : 'NO_CURRENCY');
            const tokenInWrapped = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === tokenInLabel)?.wrapped1155;
            const tokenOutWrapped = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === tokenOutLabel)?.wrapped1155;
            
            if (!tokenInWrapped || !tokenOutWrapped) {
                throw new Error('Could not find wrapped token addresses');
            }
            
            // Find the pool and price
            const poolName = isYes ? 'YES_COMPANY/YES_CURRENCY' : 'NO_COMPANY/NO_CURRENCY';
            const pool = this.pools.conditionalPools.find(p => p.name === poolName);
            const price = this.prices[poolName];
            
            if (!pool || !price) {
                throw new Error(`${poolName} pool or price not found`);
            }
            
            // Calculate expected output based on pool price
            let expectedAmountOut;
            if (isBuy) {
                // Buying company with currency
                const companyIsToken0 = price.token0.toLowerCase() === tokenOutWrapped.toLowerCase();
                const rate = companyIsToken0 ? price.priceInverse : price.price;
                expectedAmountOut = parseFloat(amount) / rate;
            } else {
                // Selling company for currency
                const companyIsToken0 = price.token0.toLowerCase() === tokenInWrapped.toLowerCase();
                const rate = companyIsToken0 ? price.price : price.priceInverse;
                expectedAmountOut = parseFloat(amount) * rate;
            }
            
            // Ask for slippage tolerance
            const { slippage } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'slippage',
                    message: 'Slippage tolerance (%):',
                    default: '0.5',
                    validate: (input) => {
                        const num = parseFloat(input);
                        return num >= 0 && num <= 50 || 'Please enter a valid slippage (0-50%)';
                    }
                }
            ]);
            
            // Calculate minimum output with slippage
            const slippageBps = Math.floor(parseFloat(slippage) * 100);
            const slippageMultiplier = 1 - (slippageBps / 10000);
            const minAmountOut = expectedAmountOut * slippageMultiplier;
            const minAmountOutWei = BigInt(Math.floor(minAmountOut * (10 ** 18))); // 18 decimals for wrapped1155
            
            // Show swap preview
            console.log(chalk.cyan('\n📊 Swap Preview:'));
            console.log(chalk.gray(`  Pool: ${poolName}`));
            console.log(chalk.gray(`  Input: ${amount} ${tokenInLabel}`));
            console.log(chalk.gray(`  Expected output: ${expectedAmountOut.toFixed(6)} ${tokenOutLabel}`));
            console.log(chalk.gray(`  Minimum output (${slippage}% slippage): ${minAmountOut.toFixed(6)} ${tokenOutLabel}`));
            
            const { confirmSwap } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmSwap',
                    message: 'Proceed with swap?',
                    default: true
                }
            ]);
            
            if (!confirmSwap) return;
            
            const swapSpinner = ora('Preparing swap...').start();
            
            // Check existing balance and split if needed
            const existingBalance = conditionalBalances.find(b => b.label === tokenInLabel)?.balance || 0n;
            
            if (existingBalance < amountWei) {
                const splitNeeded = amountWei - existingBalance;
                swapSpinner.text = `Need to split ${formatEther(splitNeeded)} more tokens...`;
                
                // Determine which collateral to split
                const collateralToken = isBuy ? this.tokens.currencyToken : this.tokens.companyToken;
                
                // Ensure approval for splitting
                await this.ensureApproval(collateralToken, ROUTER_ADDRESS, splitNeeded);
                
                // Execute split
                swapSpinner.text = 'Splitting collateral into conditional tokens...';
                for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                    proposal: this.proposal.address,
                    amount: splitNeeded,
                    collateralToken: collateralToken
                })) {
                    if (status.status === 'success') {
                        console.log(chalk.green('\n✅ Split transaction:'), status.data.transactionHash);
                    } else if (status.status === 'error') {
                        throw new Error(`Split failed: ${status.error}`);
                    }
                }
            }
            
            // Ensure approval for swap
            swapSpinner.text = 'Checking token approval for swap...';
            await this.ensureApproval(tokenInWrapped, '0xffb643e73f280b97809a8b41f7232ab401a04ee1', amountWei);
            
            // Execute swap through Algebra router
            swapSpinner.text = 'Executing swap on Algebra...';
            
            const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now
            
            try {
                const hash = await this.walletClient.writeContract({
                    address: '0xffb643e73f280b97809a8b41f7232ab401a04ee1', // Swapr V3 Router
                    abi: [{
                        "name": "exactInputSingle",
                        "type": "function",
                        "stateMutability": "payable",
                        "inputs": [
                            {
                                "name": "params",
                                "type": "tuple",
                                "components": [
                                    {"name": "tokenIn", "type": "address"},
                                    {"name": "tokenOut", "type": "address"},
                                    {"name": "recipient", "type": "address"},
                                    {"name": "deadline", "type": "uint256"},
                                    {"name": "amountIn", "type": "uint256"},
                                    {"name": "amountOutMinimum", "type": "uint256"},
                                    {"name": "limitSqrtPrice", "type": "uint160"}
                                ]
                            }
                        ],
                        "outputs": [{"name": "amountOut", "type": "uint256"}]
                    }],
                    functionName: 'exactInputSingle',
                    args: [{
                        tokenIn: tokenInWrapped,
                        tokenOut: tokenOutWrapped,
                        recipient: this.account.address,
                        deadline: BigInt(deadline),
                        amountIn: amountWei,
                        amountOutMinimum: minAmountOutWei,
                        limitSqrtPrice: 0n
                    }],
                    account: this.account
                });
                
                swapSpinner.text = 'Waiting for transaction confirmation...';
                const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
                
                swapSpinner.succeed(`Swap executed successfully!`);
                console.log(chalk.green('✅ Transaction:'), hash);
                console.log(chalk.gray(`  Gas used: ${receipt.gasUsed.toString()}`));
                
                // Refresh balances
                await this.fetchBalances();
                
            } catch (error) {
                swapSpinner.fail('Swap failed');
                console.log(chalk.yellow('\n⚠️  This might be due to:'));
                console.log(chalk.gray('  - Insufficient liquidity in the pool'));
                console.log(chalk.gray('  - Price moved beyond slippage tolerance'));
                console.log(chalk.gray('  - Pool may need initialization'));
                throw error;
            }
            
        } catch (error) {
            spinner.fail(`Failed to swap: ${error.message}`);
        }
    }