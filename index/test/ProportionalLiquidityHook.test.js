const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProportionalLiquidityHook", function () {
  let hook;
  let owner;
  let addr1;
  let addr2;
  
  // Token addresses on Gnosis Chain
  const SDAI = "0xaf204776c7245bf4147c2612bf6e5972ee483701"; // sDAI on Gnosis
  const GNO = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb";   // GNO on Gnosis
  
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
    hook = await ProportionalLiquidityHook.deploy(
      [SDAI, GNO],
      [100, 100], // 1:1 ratio
      owner.address
    );
    // Remove the deprecated .deployed() call - contract is ready after deploy()
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await hook.owner()).to.equal(owner.address);
    });

    it("Should set correct pool tokens", async function () {
      const tokens = await hook.getPoolTokens();
      expect(tokens).to.deep.equal([SDAI, GNO]);
    });

    it("Should set correct pool weights", async function () {
      const weights = await hook.getPoolWeights();
      expect(weights[0]).to.equal(100);
      expect(weights[1]).to.equal(100);
    });

    it("Should calculate total weight correctly", async function () {
      expect(await hook.totalWeight()).to.equal(200);
    });
  });

  describe("Proportional Calculations", function () {
    it("Should calculate correct proportional amounts for initial liquidity", async function () {
      const baseAmount = ethers.utils.parseEther("1"); // 1 sDAI
      const amounts = await hook.calculateProportionalAmounts(0, baseAmount);
      
      // For 1:1 ratio, 1 sDAI should require 1 GNO
      const expectedSDAI = ethers.utils.parseEther("1"); // 1 sDAI
      const expectedGNO = ethers.utils.parseEther("1");  // 1 GNO
      
      expect(amounts[0]).to.equal(expectedSDAI);
      expect(amounts[1]).to.equal(expectedGNO);
    });

    it("Should calculate correct proportional amounts for GNO base", async function () {
      const baseAmount = ethers.utils.parseEther("1"); // 1 GNO
      const amounts = await hook.calculateProportionalAmounts(1, baseAmount);
      
      // For 1:1 ratio, 1 GNO should require 1 sDAI
      const expectedSDAI = ethers.utils.parseEther("1"); // 1 sDAI
      const expectedGNO = ethers.utils.parseEther("1");  // 1 GNO
      
      expect(amounts[0]).to.equal(expectedSDAI);
      expect(amounts[1]).to.equal(expectedGNO);
    });

    it("Should calculate tiny amounts correctly", async function () {
      const tinyAmount = ethers.utils.parseUnits("0.000000000001", 18); // 1e-12
      const amounts = await hook.calculateProportionalAmounts(0, tinyAmount);
      
      // Both should be the same tiny amount for 1:1 ratio
      expect(amounts[0]).to.equal(tinyAmount);
      expect(amounts[1]).to.equal(tinyAmount);
    });
  });

  describe("Input Validation", function () {
    it("Should revert with invalid tokens length", async function () {
      const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
      
      await expect(
        ProportionalLiquidityHook.deploy(
          [], // empty tokens array
          [100, 100],
          owner.address
        )
      ).to.be.revertedWithCustomError(hook, "InvalidTokensLength");
    });

    it("Should revert with mismatched tokens and weights length", async function () {
      const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
      
      await expect(
        ProportionalLiquidityHook.deploy(
          [SDAI, GNO],
          [100], // only one weight for two tokens
          owner.address
        )
      ).to.be.revertedWithCustomError(hook, "InvalidWeightsLength");
    });

    it("Should revert with zero weight", async function () {
      const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
      
      await expect(
        ProportionalLiquidityHook.deploy(
          [SDAI, GNO],
          [100, 0], // zero weight
          owner.address
        )
      ).to.be.revertedWithCustomError(hook, "ZeroWeight");
    });
  });

  describe("Events", function () {
    it("Should emit PoolWeightsSet event on deployment", async function () {
      const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
      
      await expect(
        ProportionalLiquidityHook.deploy(
          [SDAI, GNO],
          [100, 100],
          owner.address
        )
      ).to.emit(ProportionalLiquidityHook, "PoolWeightsSet")
       .withArgs([SDAI, GNO], [100, 100]);
    });
  });

  describe("View Functions", function () {
    it("Should return correct token balance", async function () {
      expect(await hook.getTokenBalance(SDAI)).to.equal(0);
      expect(await hook.getTokenBalance(GNO)).to.equal(0);
    });

    it("Should return total supply", async function () {
      expect(await hook.totalSupply()).to.equal(0);
    });

    it("Should return user balance", async function () {
      expect(await hook.balanceOf(addr1.address)).to.equal(0);
    });
  });

  describe("Complex Scenarios", function () {
    it("Should maintain exact 1:1 ratio for different amounts", async function () {
      const testCases = [
        { base: "0.5", expected: "0.5" },
        { base: "1", expected: "1" },
        { base: "2.5", expected: "2.5" },
        { base: "10", expected: "10" },
        { base: "0.000000000001", expected: "0.000000000001" } // Tiny amount test
      ];

      for (const testCase of testCases) {
        const baseAmount = ethers.utils.parseEther(testCase.base);
        const amounts = await hook.calculateProportionalAmounts(0, baseAmount);
        
        const actualSDAI = ethers.utils.formatEther(amounts[0]);
        const actualGNO = ethers.utils.formatEther(amounts[1]);
        
        expect(actualSDAI).to.equal(testCase.expected);
        expect(actualGNO).to.equal(testCase.expected);
        
        // Verify 1:1 ratio
        const ratio = Number(actualSDAI) / Number(actualGNO);
        expect(ratio).to.be.closeTo(1, 0.0001); // Allow small precision error
      }
    });

    it("Should work with different weight configurations", async function () {
      // Test 2:1 ratio
      const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
      const hook2to1 = await ProportionalLiquidityHook.deploy(
        [SDAI, GNO],
        [200, 100], // 2:1 ratio
        owner.address
      );
      
      const baseAmount = ethers.utils.parseEther("1"); // 1 GNO
      const amounts = await hook2to1.calculateProportionalAmounts(1, baseAmount);
      
      const sdaiAmount = ethers.utils.formatEther(amounts[0]);
      const gnoAmount = ethers.utils.formatEther(amounts[1]);
      
      expect(Number(sdaiAmount)).to.equal(2); // 2 sDAI for 1 GNO
      expect(Number(gnoAmount)).to.equal(1);
    });
  });
}); 