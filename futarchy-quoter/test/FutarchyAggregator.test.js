const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Futarchy Aggregator System", function () {
    let ProposalMetadataFactory, OrganizationMetadataFactory, FutarchyAggregatorFactory;
    let proposalFactory, organizationFactory, aggregatorFactory;
    let owner, addr1;

    before(async function () {
        [owner, addr1] = await ethers.getSigners();

        ProposalMetadataFactory = await ethers.getContractFactory("ProposalMetadataFactory");
        OrganizationMetadataFactory = await ethers.getContractFactory("OrganizationMetadataFactory");
        FutarchyAggregatorFactory = await ethers.getContractFactory("FutarchyAggregatorFactory");

        proposalFactory = await ProposalMetadataFactory.deploy();
        organizationFactory = await OrganizationMetadataFactory.deploy();
        aggregatorFactory = await FutarchyAggregatorFactory.deploy();

        // WaitForDeployment is for ethers v6, for v5 it's .deployed()
        // Checking environment, assuming v6 or similar modern hardhat setup
        if (proposalFactory.waitForDeployment) {
            await proposalFactory.waitForDeployment();
            await organizationFactory.waitForDeployment();
            await aggregatorFactory.waitForDeployment();
        } else {
            await proposalFactory.deployed();
            await organizationFactory.deployed();
            await aggregatorFactory.deployed();
        }
    });

    it("Should create a Proposal Metadata", async function () {
        const dummyProposal = owner.address; // Use owner address as dummy proposal logic address
        const tx = await proposalFactory.createProposalMetadata(
            dummyProposal,
            "Will GIP-144 pass?",
            "GIP-144",
            "Detailed description here"
        );
        const receipt = await tx.wait();

        // Find event
        // ethers v6: receipt.logs
        // ethers v5: receipt.events
        const event = receipt.logs.find(log => {
            // Simple check if we can parse it, or just query contract if address is known
            try {
                return proposalFactory.interface.parseLog(log).name === "ProposalMetadataCreated";
            } catch (e) { return false; }
        }) || (receipt.events && receipt.events.find(e => e.event === "ProposalMetadataCreated"));

        expect(event).to.not.be.undefined;

        let args;
        if (event.args) {
            args = event.args;
        } else {
            // v6 decoding
            args = proposalFactory.interface.parseLog(event).args;
        }

        const metadataAddress = args.metadata;
        const Metadata = await ethers.getContractFactory("FutarchyProposalMetadata");
        const metadata = Metadata.attach(metadataAddress);

        expect(await metadata.displayNameQuestion()).to.equal("Will GIP-144 pass?");
        expect(await metadata.owner()).to.equal(owner.address);
    });

    it("Should create an Organization and add Proposal", async function () {
        const tx = await organizationFactory.createOrganizationMetadata("GnosisDAO");
        const receipt = await tx.wait();

        let args;
        const event = receipt.logs.find(log => {
            try { return organizationFactory.interface.parseLog(log).name === "OrganizationMetadataCreated"; } catch (e) { return false; }
        }) || (receipt.events && receipt.events.find(e => e.event === "OrganizationMetadataCreated"));

        if (event.args) args = event.args;
        else args = organizationFactory.interface.parseLog(event).args;

        const orgAddress = args.metadata;
        const Organization = await ethers.getContractFactory("FutarchyOrganizationMetadata");
        const organization = Organization.attach(orgAddress);

        expect(await organization.companyName()).to.equal("GnosisDAO");

        // Create another proposal to add
        const tx2 = await proposalFactory.createProposalMetadata(
            owner.address, "Q2", "E2", "D2"
        );
        const receipt2 = await tx2.wait();
        // Get address (simplified finding)
        let propAddr;
        // Iterate logs to find address
        for (const log of receipt2.logs) {
            try {
                const parsed = proposalFactory.interface.parseLog(log);
                if (parsed.name === "ProposalMetadataCreated") {
                    propAddr = parsed.args.metadata;
                    break;
                }
            } catch (e) { }
        }
        if (!propAddr && receipt2.events) propAddr = receipt2.events.find(e => e.event === "ProposalMetadataCreated").args.metadata;

        await organization.addProposal(propAddr);
        expect(await organization.getProposalsCount()).to.equal(1);

        const props = await organization.getProposals(0, 10);
        expect(props[0]).to.equal(propAddr);
    });

    it("Should create an Aggregator and add Organization", async function () {
        const tx = await aggregatorFactory.createAggregatorMetadata("MainAggregator");
        const receipt = await tx.wait();

        let args;
        const event = receipt.logs.find(log => {
            try { return aggregatorFactory.interface.parseLog(log).name === "AggregatorMetadataCreated"; } catch (e) { return false; }
        }) || (receipt.events && receipt.events.find(e => e.event === "AggregatorMetadataCreated"));

        if (event.args) args = event.args;
        else args = aggregatorFactory.interface.parseLog(event).args;

        const aggAddress = args.metadata;
        const Aggregator = await ethers.getContractFactory("FutarchyAggregatorsMetadata");
        const aggregator = Aggregator.attach(aggAddress);

        expect(await aggregator.aggregatorName()).to.equal("MainAggregator");

        // Create org
        const tx2 = await organizationFactory.createOrganizationMetadata("Org2");
        const receipt2 = await tx2.wait();
        let orgAddr;
        for (const log of receipt2.logs) {
            try {
                const parsed = organizationFactory.interface.parseLog(log);
                if (parsed.name === "OrganizationMetadataCreated") {
                    orgAddr = parsed.args.metadata;
                    break;
                }
            } catch (e) { }
        }
        if (!orgAddr && receipt2.events) orgAddr = receipt2.events.find(e => e.event === "OrganizationMetadataCreated").args.metadata;

        await aggregator.addOrganization(orgAddr);
        expect(await aggregator.getOrganizationsCount()).to.equal(1);
    });
});
