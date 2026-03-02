const hre = require("hardhat");
const { ethers } = hre;

// Clones-based Factories (Deployed just now)
const FACTORIES = {
    PROPOSAL: "0xdc1248BD6ef64476166cD9823290dF597Ea4Ddb6",
    ORGANIZATION: "0xf4AeE123eEd6B86121F289EC81877150E0FD53Ae",
    AGGREGATOR: "0x511D18d5567d76bbd20dEaDF4F90CD9f039eEd2D"
};

const DATA = {
    PROPOSAL_ADDR: "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418",
    QUESTION: "What will be the price of GNO",
    EVENT: "if its price is >= 130 sDAI?",
    DESCRIPTION: "Will GNO price be at or above 130 sDAI (Savings xDAI) at December 28, 2025 11:59 PM?",
    COMPANY_NAME: "GNOSIS DAO",
    COMPANY_DESC: "Gnosis DAO is the decentralized autonomous organization governing the Gnosis ecosystem.",
    AGGREGATOR_NAME: "FutarchyFi",
    AGGREGATOR_DESC: "The premier aggregation layer for Futarchy markets."
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 Executing Metadata Workflow with: ${signer.address}`);

    const gasConfig = { gasPrice: 5000000000 };

    // 1. Create Proposal Metadata
    console.log("\n1️⃣  Creating Proposal Metadata...");
    const ProposalFactory = await ethers.getContractAt("ProposalMetadataFactory", FACTORIES.PROPOSAL);

    const tx1 = await ProposalFactory.createProposalMetadata(
        DATA.PROPOSAL_ADDR,
        DATA.QUESTION,
        DATA.EVENT,
        DATA.DESCRIPTION,
        gasConfig
    );
    console.log(`   Tx Sent: ${tx1.hash}`);
    const receipt1 = await tx1.wait();

    // Parse event to get address
    const event1 = receipt1.logs.find(log => {
        try { return ProposalFactory.interface.parseLog(log)?.name === "ProposalMetadataCreated"; } catch (e) { return false; }
    });
    const proposalMetadataAddr = ProposalFactory.interface.parseLog(event1).args.metadata;
    console.log(`   ✅ Proposal Metadata Created: ${proposalMetadataAddr}`);

    // 2. Create Organization
    console.log(`\n2️⃣  Creating Organization: ${DATA.COMPANY_NAME}...`);
    const OrgFactory = await ethers.getContractAt("OrganizationMetadataFactory", FACTORIES.ORGANIZATION);

    const tx2 = await OrgFactory.createOrganizationMetadata(DATA.COMPANY_NAME, DATA.COMPANY_DESC, gasConfig);
    console.log(`   Tx Sent: ${tx2.hash}`);
    const receipt2 = await tx2.wait();

    const event2 = receipt2.logs.find(log => {
        try { return OrgFactory.interface.parseLog(log)?.name === "OrganizationMetadataCreated"; } catch (e) { return false; }
    });
    const orgMetadataAddr = OrgFactory.interface.parseLog(event2).args.metadata;
    console.log(`   ✅ Organization Created: ${orgMetadataAddr}`);

    // 3. Link Proposal
    console.log(`\n3️⃣  Adding Proposal to Organization...`);
    // Note: Use FutarchyOrganizationMetadata (Clone) 
    const Organization = await ethers.getContractAt("FutarchyOrganizationMetadata", orgMetadataAddr);
    const tx3 = await Organization.addProposal(proposalMetadataAddr, gasConfig);
    await tx3.wait();
    console.log(`   ✅ Linked.`);

    // 4. Create Aggregator
    console.log(`\n4️⃣  Creating Aggregator: ${DATA.AGGREGATOR_NAME}...`);
    const AggFactory = await ethers.getContractAt("FutarchyAggregatorFactory", FACTORIES.AGGREGATOR);

    const tx4 = await AggFactory.createAggregatorMetadata(DATA.AGGREGATOR_NAME, DATA.AGGREGATOR_DESC, gasConfig);
    console.log(`   Tx Sent: ${tx4.hash}`);
    const receipt4 = await tx4.wait();

    const event4 = receipt4.logs.find(log => {
        try { return AggFactory.interface.parseLog(log)?.name === "AggregatorMetadataCreated"; } catch (e) { return false; }
    });
    const aggMetadataAddr = AggFactory.interface.parseLog(event4).args.metadata;
    console.log(`   ✅ Aggregator Created: ${aggMetadataAddr}`);

    // 5. Link Organization
    console.log(`\n5️⃣  Adding Organization to Aggregator...`);
    const Aggregator = await ethers.getContractAt("FutarchyAggregatorsMetadata", aggMetadataAddr);
    const tx5 = await Aggregator.addOrganization(orgMetadataAddr, gasConfig);
    await tx5.wait();
    console.log(`   ✅ Linked.`);

    console.log("\n📜 Final Summary:");
    console.log({
        ProposalMetadata: proposalMetadataAddr,
        Organization: orgMetadataAddr,
        Aggregator: aggMetadataAddr
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
