const { ethers } = require('ethers');
const constants = require('../contracts/constants');

class ProposalCreator {
  constructor(wallet) {
    this.wallet = wallet;
    
    // Initialize factory contract
    this.factory = new ethers.Contract(
      constants.FUTARCHY_FACTORY,
      [
        'function createProposal((string,address,address,string,string,uint256,uint32)) returns (address)',
        'function proposals(uint256) view returns (address)',
        'function marketsCount() view returns (uint256)'
      ],
      wallet
    );
  }

  // Create a new futarchy proposal
  async createProposal(params) {
    const {
      marketName,
      companyTokenAddress,
      currencyTokenAddress,
      category = constants.DEFAULT_CATEGORY,
      language = constants.DEFAULT_LANGUAGE,
      minBond = constants.DEFAULT_MIN_BOND,
      openingTime = Math.floor(Date.now() / 1000) + constants.DEFAULT_OPENING_TIME_OFFSET,
      gasOptions = {}
    } = params;

    console.log('\n📝 Creating Futarchy Proposal:');
    console.log(`  Market: ${marketName}`);
    console.log(`  Company Token: ${companyTokenAddress}`);
    console.log(`  Currency Token: ${currencyTokenAddress}`);
    console.log(`  Category: ${category}`);
    console.log(`  Language: ${language}`);
    console.log(`  Opening Time: ${new Date(openingTime * 1000).toLocaleString()}`);

    const proposalParams = [
      marketName,
      companyTokenAddress,
      currencyTokenAddress,
      category,
      language,
      minBond,
      openingTime
    ];

    // Optional: predict proposal address via static call (no state change)
    let predictedAddress = null;
    try {
      if (this.factory.createProposal && this.factory.createProposal.staticCall) {
        predictedAddress = await this.factory.createProposal.staticCall(proposalParams);
        console.log(`  🔮 Predicted proposal address (static): ${predictedAddress}`);
      }
    } catch (_) {
      // Ignore prediction errors; proceed to send tx
    }

    // Estimate gas with a safety buffer when possible
    let finalGasLimit = gasOptions.gasLimit || constants.GAS_SETTINGS.CREATE_PROPOSAL;
    try {
      if (this.factory.estimateGas && this.factory.estimateGas.createProposal) {
        const estimated = await this.factory.estimateGas.createProposal(proposalParams);
        // Add a generous buffer: 30% + 200k to cover string writes and CREATE2
        const buffered = ((estimated * 130n) / 100n) + 200000n;
        // Ensure we don't go below configured default if it's higher
        finalGasLimit = buffered > finalGasLimit ? buffered : finalGasLimit;
      }
    } catch (_) {
      // Fallback to configured gas limit
    }

    const tx = await this.factory.createProposal(
      proposalParams,
      {
        gasLimit: finalGasLimit,
        // Note: CREATE_PROPOSAL uses auto gas price (network determined)
        ...gasOptions
      }
    );

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    
    // Resolve proposal address: prefer static prediction, else parse event; otherwise guide the user
    let proposalAddress = predictedAddress || null;
    
    // Try to find the event in the logs
    for (const log of receipt.logs) {
      try {
        const parsed = this.factory.interface.parseLog(log);
        if (parsed && parsed.name === 'ProposalCreated') {
          proposalAddress = parsed.args[0];
          break;
        }
      } catch {
        // Continue checking other logs
      }
    }
    
    if (!proposalAddress) {
      console.warn('  ⚠️ Could not determine proposal address automatically (no event decoded).');
      console.warn('  Please retrieve it from the explorer and set proposalAddress in your config.');
      console.warn(`  Explorer tx: ${constants.getExplorerTxLink(tx.hash)}`);
      throw new Error('Proposal address not determined; supply proposalAddress in config.');
    }

    console.log(`  ✅ Proposal created: ${proposalAddress}`);

    return {
      proposalAddress,
      transactionHash: tx.hash,
      receipt,
      marketName,
      openingTime
    };
  }

  // Load existing proposal details
  async loadProposal(proposalAddress) {
    const proposal = new ethers.Contract(
      proposalAddress,
      [
        'function marketName() view returns (string)',
        'function collateralToken1() view returns (address)',
        'function collateralToken2() view returns (address)',
        'function wrappedOutcome(uint256 index) view returns (address, bytes)'
      ],
      this.wallet
    );

    try {
      // Get basic info
      const marketName = await proposal.marketName();
      const companyToken = await proposal.collateralToken1();
      const currencyToken = await proposal.collateralToken2();
      
      // For now, use a default opening time (we can't easily decode the complex tuple)
      const openingTime = Math.floor(Date.now() / 1000) + constants.DEFAULT_OPENING_TIME_OFFSET;
      
      // Get conditional token addresses
      const [yesCompanyAddr] = await proposal.wrappedOutcome(0);
      const [noCompanyAddr] = await proposal.wrappedOutcome(1);
      const [yesCurrencyAddr] = await proposal.wrappedOutcome(2);
      const [noCurrencyAddr] = await proposal.wrappedOutcome(3);

      return {
        proposalAddress,
        marketName,
        companyToken,
        currencyToken,
        openingTime: Number(openingTime),
        yesCompanyToken: yesCompanyAddr,
        noCompanyToken: noCompanyAddr,
        yesCurrencyToken: yesCurrencyAddr,
        noCurrencyToken: noCurrencyAddr
      };
    } catch (error) {
      console.error('Error loading proposal:', error.message);
      throw error;
    }
  }
}

module.exports = ProposalCreator;
