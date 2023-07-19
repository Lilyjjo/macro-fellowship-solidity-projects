import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  SpaceCoin,
  SpaceICO,
  SpaceICO__factory,
  SpaceCoin__factory,
} from "../typechain";

// ----------------------------------------------------------------------------
// Constants and Helper Functions
// ----------------------------------------------------------------------------

// Bump the timestamp by a specific amount of seconds
const timeTravel = async (seconds: number) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

// ----------------------------------------------------------------------------

describe("SpaceCoin", () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let SpaceICO: SpaceICO__factory;
  let spaceICO: SpaceICO;
  let spaceCoin: SpaceCoin;

  beforeEach(async () => {
    [deployer, owner, treasury, alice, bob] = await ethers.getSigners();

    SpaceICO = await ethers.getContractFactory("SpaceICO");
    spaceICO = (await SpaceICO.deploy(
      owner.address,
      treasury.address
    )) as SpaceICO;
    await spaceICO.deployed();

    let spaceCoinAddress = await spaceICO.spaceCoin();
    let SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    spaceCoin = await SpaceCoin.attach(spaceCoinAddress);
  });

  describe("Token Contract", () => {
    it('Is named "SpaceCoin" with symbol "SPC"', async () => {
      expect(await spaceCoin.name()).to.equal("SpaceCoin");
      expect(await spaceCoin.symbol()).to.equal("SPC");
    });
    it("Allocates 150,000 of supply to the ICO investors", async () => {
      expect(await spaceCoin.balanceOf(spaceICO.address)).to.equal(
        ethers.utils.parseEther("150000")
      );
    });
    it("Stores the remaining 350,000 of supply in the treausry", async () => {
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("350000")
      );
    });
    it("Tax starts off as off", async () => {
      expect(await spaceCoin.tax()).to.equal(false);
    });
    it("Allows owner to toggle on/off a 2% tax for the transfers into the treausry account", async () => {
      expect(await spaceCoin.connect(owner).setTax(true)).to.be.ok;
      expect(await spaceCoin.connect(owner).setTax(false)).to.be.ok;
    });
    it("Tax can't be set to the same state", async () => {
      await expect(spaceCoin.connect(owner).setTax(false)).to.revertedWith(
        "Tax already set"
      );
    });
    it("Prevents non owners from toggle on/off the 2% tax", async () => {
      await expect(spaceCoin.connect(alice).setTax(true)).to.revertedWith(
        "Only owner can set tax"
      );
    });
    it("Charges 0% for SPC transfers when tax is toggled off", async () => {
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("0")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("350000")
      );
      await spaceCoin
        .connect(treasury)
        .transfer(bob.address, ethers.utils.parseEther("100"));
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("100")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("349900")
      );
    });
    it("Charges 2% for SPC transfers (deposited into the treasury) when tax is toggled on", async () => {
      expect(await spaceCoin.connect(owner).setTax(true)).to.be.ok;
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("0")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("350000")
      );
      await spaceCoin
        .connect(treasury)
        .transfer(bob.address, ethers.utils.parseEther("100"));
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("98")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("349902")
      );
    });
    it("Charges 0% for SPC transfers, using transferFrom, when tax is toggled off", async () => {
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("0")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("350000")
      );
      await spaceCoin
        .connect(treasury)
        .approve(bob.address, ethers.utils.parseEther("100"));
      await spaceCoin
        .connect(bob)
        .transferFrom(
          treasury.address,
          bob.address,
          ethers.utils.parseEther("100")
        );
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("100")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("349900")
      );
    });
    it("Charges 2% for SPC transfers (deposited into the treasury) when tax is toggled on", async () => {
      expect(await spaceCoin.connect(owner).setTax(true)).to.be.ok;
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("0")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("350000")
      );
      await spaceCoin
        .connect(treasury)
        .approve(bob.address, ethers.utils.parseEther("100"));
      await spaceCoin
        .connect(bob)
        .transferFrom(
          treasury.address,
          bob.address,
          ethers.utils.parseEther("100")
        );
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("98")
      );
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(
        ethers.utils.parseEther("349902")
      );
    });
    it("Emits an TaxChanged event", async () => {
      const txReceiptUnresolved = await spaceCoin.connect(owner).setTax(true);
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![0].event).to.equal("TaxChanged");
    });
  });

  describe("Management", () => {
    it("Allows owner to advance phase forward one step", async () => {
      expect(await spaceICO.state()).to.equal(0);
      expect(await spaceICO.connect(owner).moveForward(1)).to.be.ok;
      expect(await spaceICO.state()).to.equal(1);
    });
    it("Allows owner to advance phase forward two steps", async () => {
      expect(await spaceICO.state()).to.equal(0);
      expect(await spaceICO.connect(owner).moveForward(2)).to.be.ok;
      expect(await spaceICO.state()).to.equal(2);
    });
    it("Prevents owner from setting phase backwards", async () => {
      await spaceICO.connect(owner).moveForward(2);
      await expect(spaceICO.connect(owner).moveForward(1)).to.be.revertedWith(
        "Can't set state backwards"
      );
    });
    it("Prevents owner from setting invalid phase", async () => {
      await expect(spaceICO.connect(owner).moveForward(3)).to.be.reverted;
    });
    it("Prevents owner from setting phase to current phase", async () => {
      await spaceICO.connect(owner).moveForward(2);
      await expect(spaceICO.connect(owner).moveForward(2)).to.be.revertedWith(
        "ICO already at that state"
      );
    });
    it("Prevents non-owners from setting phase", async () => {
      await expect(spaceICO.connect(alice).moveForward(1)).to.be.revertedWith(
        "Only the owner can call"
      );
    });
    // it("Emits a PhaseAdvance event after phase is advanced", async () => {
    //   await expect(false).to.be.ok;
    // });
    it("Allows owner to pause and resume funding", async () => {
      expect(await spaceICO.connect(owner).setPaused(true)).to.be.ok;
      expect(await spaceICO.paused()).to.equal(true);
      expect(await spaceICO.connect(owner).setPaused(false)).to.be.ok;
      expect(await spaceICO.paused()).to.equal(false);
    });
    it("Disallows owner to set paused state to same", async () => {
      await expect(spaceICO.connect(owner).setPaused(false)).to.be.revertedWith(
        "Paused already in that state"
      );
    });
    it("Prevents non-owners from pausing/resuming funding", async () => {
      await expect(spaceICO.connect(alice).setPaused(true)).to.be.revertedWith(
        "Only the owner can call"
      );
    });
    // it("Emits a Paused event after contract is paused", async () => {
    //   await expect(false).to.be.ok;
    // });
    it("Allows owner to add seed investors to allowlist", async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
      expect(await spaceICO.allowList(bob.address)).to.equal(true);
    });
    it("Prevents owner from adding same seed investors to allowlist", async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
      await expect(
        spaceICO.connect(owner).addAllowlist(bob.address)
      ).to.be.revertedWith("Investor already added");
    });
    it("Prevents non-owners from adding investors to allowlist", async () => {
      await expect(
        spaceICO.connect(alice).addAllowlist(bob.address)
      ).to.be.revertedWith("Only the owner can call");
    });
    it("Blocks fundraising when contract is paused", async () => {
      await spaceICO.connect(owner).setPaused(true);
      await expect(
        spaceICO
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("ICO is paused");
    });
  });

  describe("Contributions: Seed Phase", () => {
    beforeEach(async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
    });

    it("Allows contributors from allowlist", async () => {
      await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      expect(await spaceICO.contributionBalances(bob.address)).to.equal(
        ethers.utils.parseEther("1")
      );
    });
    it("Blocks people not on allowlist", async () => {
      await expect(
        spaceICO
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Not approved for seed phase");
    });
    it("Blocks contributions exceeding seed phase goal", async () => {
      for (let i = 0; i < 14; i++) {
        let wallet = ethers.Wallet.createRandom();
        wallet = wallet.connect(ethers.provider);
        await deployer.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1100"),
        });
        await spaceICO.connect(owner).addAllowlist(wallet.address);
        await spaceICO
          .connect(wallet)
          .contribute({ value: ethers.utils.parseEther("1000") });
      }
      // total 14,000 contributed at this point
      await expect(
        spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("2000") })
      ).to.be.revertedWith("Amount > than seed space left");
    });
    it("Allows people to hit their individual seed limit", async () => {
      expect(
        await spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("1500") })
      ).to.be.ok;
    });
    it("Blocks people who try to pass their seed limit", async () => {
      await expect(
        spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("2000") })
      ).to.be.revertedWith("Individual seed limit hit");
    });
    it("Allows people to hit seed phase goal", async () => {
      for (let i = 0; i < 14; i++) {
        let wallet = ethers.Wallet.createRandom();
        wallet = wallet.connect(ethers.provider);
        await deployer.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1100"),
        });
        await spaceICO.connect(owner).addAllowlist(wallet.address);
        await spaceICO
          .connect(wallet)
          .contribute({ value: ethers.utils.parseEther("1000") });
      }
      // total 14,000 contributed at this point
      expect(
        await spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("1000") })
      ).to.be.ok;
      expect(await spaceICO.icoAllocationLeft()).to.equal(
        ethers.utils.parseEther("15000")
      );
    });
    it("Blocks token redemption during Seed", async () => {
      await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      await expect(spaceICO.connect(bob).redeemSpaceCoin()).to.be.revertedWith(
        "ICO isn't open yet"
      );
    });
  });

  describe("Contributions: General Phase", () => {
    beforeEach(async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
      await spaceICO.connect(owner).moveForward(1);
    });
    it("Allows anyone to contribute", async () => {
      await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      await spaceICO
        .connect(alice)
        .contribute({ value: ethers.utils.parseEther("1") });
      expect(await spaceICO.contributionBalances(bob.address)).to.equal(
        ethers.utils.parseEther("1")
      );
      expect(await spaceICO.contributionBalances(alice.address)).to.equal(
        ethers.utils.parseEther("1")
      );
    });
    it("Blocks contributions who have passed individual general limit", async () => {
      await expect(
        spaceICO
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1001") })
      ).to.be.revertedWith("Individual general limit hit");
    });
    it("Blocks seed investors who have hit individual general limit", async () => {
      await expect(
        spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("1001") })
      ).to.be.revertedWith("Individual general limit hit");
    });
    it("Blocks contributions that are over ICO limit", async () => {
      for (let i = 0; i < 29; i++) {
        let wallet = ethers.Wallet.createRandom();
        wallet = wallet.connect(ethers.provider);
        await deployer.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1100"),
        });
        await spaceICO
          .connect(wallet)
          .contribute({ value: ethers.utils.parseEther("1000") });
      }
      // total 29,000 contributed at this point
      expect(
        await spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("1000") })
      ).to.be.ok;
      expect(await spaceICO.icoAllocationLeft()).to.equal(
        ethers.utils.parseEther("0")
      );
    });
    it("Blocks token redemption during General", async () => {
      await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      await expect(spaceICO.connect(bob).redeemSpaceCoin()).to.be.revertedWith(
        "ICO isn't open yet"
      );
    });
    it("Blocks contribtors going over ICO limit", async () => {
      for (let i = 0; i < 29; i++) {
        let wallet = ethers.Wallet.createRandom();
        wallet = wallet.connect(ethers.provider);
        await deployer.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1100"),
        });
        await spaceICO
          .connect(wallet)
          .contribute({ value: ethers.utils.parseEther("1000") });
      }
      // total 29,000 contributed at this point
      expect(
        await spaceICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("999") })
      ).to.be.ok;
      await expect(
        spaceICO
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("2") })
      ).to.be.revertedWith("Amount > than ICO space left");
    });
  });

  describe("Contributions: Open Phase", () => {
    beforeEach(async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
      await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      await spaceICO.connect(owner).moveForward(2);
    });
    it("Automatically redeems new contributions for tokens", async () => {
      await spaceICO
        .connect(alice)
        .contribute({ value: ethers.utils.parseEther("1") });
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5")
      );
    });
    it("Allows a pre-open phase contributions to be redeemed for tokens", async () => {
      await spaceICO.connect(bob).redeemSpaceCoin();
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(
        ethers.utils.parseEther("5")
      );
    });
    it("Prevents people from redeeming twice", async () => {
      await spaceICO.connect(bob).redeemSpaceCoin();
      await expect(spaceICO.connect(bob).redeemSpaceCoin()).to.be.revertedWith(
        "No tokens to claim"
      );
    });
    it("Prevents people with nothing to redeem from redeeming", async () => {
      await expect(
        spaceICO.connect(alice).redeemSpaceCoin()
      ).to.be.revertedWith("No tokens to claim");
    });
  });
  describe("Events", () => {
    it("Emits a Contribution event", async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
      const txReceiptUnresolved = await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![0].event).to.equal("Contribution");
    });
    it("Emits a Transfer event in redeem", async () => {
      await spaceICO.connect(owner).addAllowlist(bob.address);
      await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      await spaceICO.connect(owner).moveForward(2);
      const txReceiptUnresolved = await spaceICO.connect(bob).redeemSpaceCoin();
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![0].event).to.equal("Transfer");
    });
    it("Emits a Transfer event in contribute", async () => {
      await spaceICO.connect(owner).moveForward(2);
      const txReceiptUnresolved = await spaceICO
        .connect(bob)
        .contribute({ value: ethers.utils.parseEther("1") });
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![1].event).to.equal("Transfer");
    });
    it("Emits a NewState event", async () => {
      const txReceiptUnresolved = await spaceICO.connect(owner).moveForward(2);
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![0].event).to.equal("NewState");
    });
    it("Emits a Paused event", async () => {
      const txReceiptUnresolved = await spaceICO.connect(owner).setPaused(true);
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![0].event).to.equal("Paused");
    });
    it("Emits an InvestorAdded event", async () => {
      const txReceiptUnresolved = await spaceICO
        .connect(owner)
        .addAllowlist(bob.address);
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![0].event).to.equal("InvestorAdded");
    });
  });
});
