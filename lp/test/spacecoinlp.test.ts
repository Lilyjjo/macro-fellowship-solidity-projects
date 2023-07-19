import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  SpaceCoinLP,
  SpaceCoinLP__factory,
  SpaceCoinLPRouter,
  SpaceCoinLPRouter__factory,
  SpaceICO,
  SpaceICO__factory,
  SpaceCoin,
  SpaceCoin__factory,
} from "../typechain";

// ----------------------------------------------------------------------------
// Constants and Helper Functions
// ----------------------------------------------------------------------------

// Bump the timestamp by a specific amount of seconds
const SECONDS_IN_DAY: number = 60 * 60 * 24;
const timeTravel = async (seconds: number) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};
// ----------------------------------------------------------------------------

describe("SpaceCoinLP", () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let caleb: SignerWithAddress;

  let SpaceCoinLP: SpaceCoinLP__factory;
  let spaceCoinLP: SpaceCoinLP;
  let SpaceCoinLPRouter: SpaceCoinLPRouter__factory;
  let spaceCoinLPRouter: SpaceCoinLPRouter;
  let SpaceICO: SpaceICO__factory;
  let spaceICO: SpaceICO;
  let spaceCoin: SpaceCoin;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    [deployer, owner, treasury, alice, bob, caleb] = signers;

    SpaceICO = await ethers.getContractFactory("SpaceICO");
    spaceICO = (await SpaceICO.deploy(
      owner.address,
      treasury.address
    )) as SpaceICO;
    await spaceICO.deployed();

    let spaceCoinAddress = await spaceICO.spaceCoin();
    let SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    spaceCoin = await SpaceCoin.attach(spaceCoinAddress);

    SpaceCoinLP = await ethers.getContractFactory("SpaceCoinLP");
    spaceCoinLP = (await SpaceCoinLP.deploy(spaceCoin.address)) as SpaceCoinLP;
    await spaceCoinLP.deployed();

    SpaceCoinLPRouter = await ethers.getContractFactory("SpaceCoinLPRouter");
    spaceCoinLPRouter = (await SpaceCoinLPRouter.deploy(
      spaceCoinLP.address,
      spaceCoin.address
    )) as SpaceCoinLPRouter;
    await spaceCoinLPRouter.deployed();

    // move ICO forward
    await spaceICO.connect(owner).moveForward(2);

    // setup SpaceICO to be finished & transfer the funds to the SpaceCoinLp contract

    await spaceICO
      .connect(alice)
      .contribute({ value: ethers.utils.parseEther("1000") });
    await spaceICO
      .connect(bob)
      .contribute({ value: ethers.utils.parseEther("1000") });
    for (let i = 0; i < 28; i++) {
      const wallet = signers[5 + i];
      await spaceICO
        .connect(wallet)
        .contribute({ value: ethers.utils.parseEther("1000") });
    }
    expect(await spaceICO.icoAllocationLeft()).to.equal(
      ethers.utils.parseEther("0")
    );
    await spaceICO.connect(owner).transfer(spaceCoinLP.address);
    await spaceCoin
      .connect(treasury)
      .transfer(spaceCoinLP.address, ethers.utils.parseEther("120000"));

    // maths:
    // liquidity: 120_000 SPC, 30_000 ETH
    // alice and bob have 1,000 SPC each
    // k = 10500000000
    // starting liquidity = 60_000
    // 120_000 SPC -> 121_000 SPC
    //
  });

  describe("LP deposits", () => {
    it("Initial liquidity deposit reserves are correct", async () => {
      expect(await spaceCoinLP.totalLiquidity()).to.equal(0);
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      expect(await spaceCoinLP.totalLiquidity()).to.equal(
        ethers.utils.parseEther("60000")
      );
      expect(await spaceCoinLP.reserveSPC()).to.equal(
        ethers.utils.parseEther("120000")
      );
      expect(await spaceCoinLP.reserveETH()).to.equal(
        ethers.utils.parseEther("30000")
      );
    });
    it("Initial liquidity deposit takes out MIN_LIQUIDITY", async () => {
      expect(await spaceCoinLP.totalLiquidity()).to.equal(0);
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      expect(
        await spaceCoinLP.balanceOf(
          "0x0000000000000000000000000000000000000001"
        )
      ).to.equal(1000);
      expect(await spaceCoinLP.balanceOf(caleb.address)).to.equal(
        ethers.utils.parseEther("59999.999999999999999000")
      );
    });
    it("Next liquidity deposit doesn't take out minimum liquidity (eth less)", async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      await spaceCoin
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("1000"));
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("1000"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("500")
      );
    });
    it("Next liquidity deposit doesn't take out minimum liquidity (spc less)", async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      await spaceCoin
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("100"));
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("100000"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("50")
      );
    });
  });
  describe("LP burn", () => {
    beforeEach(async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial deposit caleb has "59999.999999999999999000" LP
      await spaceCoin
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("100"));
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("25"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      // Alice has "50" LP -- should get 100 and 25 back
    });
    it("Able to remove liquidity", async () => {
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("50")
      );
      await spaceCoinLP
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("50"));
      await spaceCoinLP.burn(alice.address);
      // original amount Alice had was 5,000 SPC
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5000")
      );
      expect(await spaceCoinLP.reserveETH()).to.equal(
        ethers.utils.parseEther("30000")
      );
      expect(await spaceCoinLP.reserveSPC()).to.equal(
        ethers.utils.parseEther("120000")
      );
    });
    it("Able to remove all but min liquidity", async () => {
      // alice drain
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("50")
      );
      await spaceCoinLP
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("50"));
      await spaceCoinLP.burn(alice.address);
      // caleb drain
      await spaceCoinLP
        .connect(caleb)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("59999.999999999999999000")
        );
      await spaceCoinLP.burn(caleb.address);
      expect(await spaceCoinLP.totalLiquidity()).to.equal(1000);
    });
    it("Not able to burn no liquidity", async () => {
      await expect(spaceCoinLP.burn(alice.address)).to.be.revertedWith(
        "Insufficient liquidity burned"
      );
    });
  });
  describe("LP swap", () => {
    beforeEach(async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial LP is 60_000
    });
    it("Able to swap with expected math", async () => {
      // eth is 30_000
      // spc is 120_000
      // k is 3_600_000_000
      // tax is 1%
      // want: 118_800 SPC (lmao)
      // need: to add 3_000_000 ETH
      // these numbers because they're whole numbers with minimal slippage
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("3000000"),
      });
      await spaceCoinLP.swap(
        alice.address,
        ethers.utils.parseEther("118800"),
        0
      );
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      expect(
        reserveETH.mul(reserveSPC).gt(ethers.utils.parseEther("3600000000"))
      ).to.be.ok;
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("123800")
      );
    });
  });
});

describe("SpaceCoinLPRouter", () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let caleb: SignerWithAddress;

  let SpaceCoinLP: SpaceCoinLP__factory;
  let spaceCoinLP: SpaceCoinLP;
  let SpaceCoinLPRouter: SpaceCoinLPRouter__factory;
  let spaceCoinLPRouter: SpaceCoinLPRouter;
  let SpaceICO: SpaceICO__factory;
  let spaceICO: SpaceICO;
  let spaceCoin: SpaceCoin;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    [deployer, owner, treasury, alice, bob, caleb] = signers;

    SpaceICO = await ethers.getContractFactory("SpaceICO");
    spaceICO = (await SpaceICO.deploy(
      owner.address,
      treasury.address
    )) as SpaceICO;
    await spaceICO.deployed();

    let spaceCoinAddress = await spaceICO.spaceCoin();
    let SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    spaceCoin = await SpaceCoin.attach(spaceCoinAddress);

    SpaceCoinLP = await ethers.getContractFactory("SpaceCoinLP");
    spaceCoinLP = (await SpaceCoinLP.deploy(spaceCoin.address)) as SpaceCoinLP;
    await spaceCoinLP.deployed();

    SpaceCoinLPRouter = await ethers.getContractFactory("SpaceCoinLPRouter");
    spaceCoinLPRouter = (await SpaceCoinLPRouter.deploy(
      spaceCoinLP.address,
      spaceCoin.address
    )) as SpaceCoinLPRouter;
    await spaceCoinLPRouter.deployed();

    // move ICO forward
    await spaceICO.connect(owner).moveForward(2);

    // setup SpaceICO to be finished & transfer the funds to the SpaceCoinLp contract

    await spaceICO
      .connect(alice)
      .contribute({ value: ethers.utils.parseEther("1000") });
    await spaceICO
      .connect(bob)
      .contribute({ value: ethers.utils.parseEther("1000") });
    for (let i = 0; i < 28; i++) {
      const wallet = signers[5 + i];
      await spaceICO
        .connect(wallet)
        .contribute({ value: ethers.utils.parseEther("1000") });
    }
    expect(await spaceICO.icoAllocationLeft()).to.equal(
      ethers.utils.parseEther("0")
    );
  });
  describe("Router addLiquidity", () => {
    const mintFirst = async () => {
      await spaceICO.connect(owner).transfer(spaceCoinLP.address);
      await spaceCoin
        .connect(treasury)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("120000"));
      await spaceCoinLP.connect(caleb).mint(caleb.address);
    };

    it("Able to mint initial amounts", async () => {
      expect(await spaceCoinLP.totalLiquidity()).to.equal(0);
      // first time, we can send in what we want
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(ethers.utils.parseEther("5000"), {
          value: ethers.utils.parseEther("5000"),
        });
      expect(await spaceCoinLP.totalLiquidity()).to.equal(
        ethers.utils.parseEther("5000")
      );
    });
    it("Able to mint spc leading amounts", async () => {
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("5000");
      let matchingEther = await spaceCoinLPRouter.matchLiquidity(
        goalSPC,
        reserveSPC,
        reserveETH,
        totalLiquidity,
        false,
        true
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(goalSPC, { value: matchingEther });
      expect((await spaceCoinLP.balanceOf(alice.address)).gt(0)).to.be.ok;
    });
    it("Able to mint eth leading amounts", async () => {
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalETH = ethers.utils.parseEther("5");
      let matchingSPC = await spaceCoinLPRouter.matchLiquidity(
        goalETH,
        reserveETH,
        reserveSPC,
        totalLiquidity,
        false,
        false
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, matchingSPC);
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(0, { value: goalETH });
      expect((await spaceCoinLP.balanceOf(alice.address)).gt(0)).to.be.ok;
    });
    it("Will revert if not enough SPC approved", async () => {
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalETH = ethers.utils.parseEther("5000");
      let matchingSPC = await spaceCoinLPRouter.matchLiquidity(
        goalETH,
        reserveETH,
        reserveSPC,
        totalLiquidity,
        false,
        false
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, matchingSPC);
      await expect(
        spaceCoinLPRouter.connect(alice).addLiquidity(0, { value: goalETH })
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
    });
    it("Will revert if not enough ETH", async () => {
      // figure out how much to send in
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("5000");
      let matchingEther = await spaceCoinLPRouter.matchLiquidity(
        goalSPC,
        reserveSPC,
        reserveETH,
        totalLiquidity,
        false,
        true
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await expect(
        spaceCoinLPRouter
          .connect(alice)
          .addLiquidity(goalSPC, { value: matchingEther.sub(3) })
      ).to.revertedWith("ETH transfer failed");
    });
    it("Will return extra ETH", async () => {
      // figure out how much to send in
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("5000");
      let matchingEther = await spaceCoinLPRouter.matchLiquidity(
        goalSPC,
        reserveSPC,
        reserveETH,
        totalLiquidity,
        false,
        true
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(goalSPC, { value: matchingEther.add(1) });
    });
  });
  describe("Router burnLiquidity", () => {
    beforeEach(async () => {
      // add initial liquidity
      await spaceICO.connect(owner).transfer(spaceCoinLP.address);
      await spaceCoin
        .connect(treasury)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("120000"));

      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial deposit caleb has "59999.999999999999999000" LP
      await spaceCoin
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("100"));
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("25"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      // Alice has "50" LP -- should get 100 and 25 back
    });
    it("Able to burn and get back liquidity", async () => {
      let lpAmount = await spaceCoinLP.balanceOf(alice.address);
      await spaceCoinLP
        .connect(alice)
        .approve(spaceCoinLPRouter.address, lpAmount);
      await spaceCoinLPRouter.connect(alice).burnLiquidity(lpAmount);
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5000")
      );
    });
  });
  describe("Router swap", () => {
    beforeEach(async () => {
      // add initial liquidity
      await spaceICO.connect(owner).transfer(spaceCoinLP.address);
      await spaceCoin
        .connect(treasury)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("120000"));

      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial deposit caleb has "59999.999999999999999000" LP
    });
    it("Swap math works", async () => {
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("118800"); // oooooofff haha, should be added 3,000,000 ETH
      let goalETH = ethers.utils.parseEther("3000000");
      let calculatedETH = await spaceCoinLPRouter.swapAmount(
        goalSPC,
        reserveSPC,
        reserveETH
      );
      //console.log(output);
      await expect(calculatedETH).to.equal(goalETH.add(1));
    });
    it("Swapping for ETH works", async () => {
      await spaceCoinLPRouter
        .connect(alice)
        .swap(0, ethers.utils.parseEther("1"), ethers.utils.parseEther("4.5"), {
          value: ethers.utils.parseEther("1000"),
        }); // price is 4
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5001")
      );
    });
    it("Swapping ETH for SPC works", async () => {
      await spaceCoinLPRouter
        .connect(alice)
        .swap(
          0,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("600"),
          {
            value: ethers.utils.parseEther("1000"),
          }
        ); // price is 4
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5010")
      );
    });
    it("Swapping for ETH works", async () => {
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("70"));
      await spaceCoinLPRouter
        .connect(alice)
        .swap(ethers.utils.parseEther("7"), 0, ethers.utils.parseEther("70"), {
          value: ethers.utils.parseEther("1000"),
        }); // price is 4
      expect(await spaceCoin.balanceOf(alice.address)).to.be.lt(
        ethers.utils.parseEther("5001")
      );
    });
  });
});

/////////////
describe("SpaceCoinLP w/ SPC TAX", () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let caleb: SignerWithAddress;

  let SpaceCoinLP: SpaceCoinLP__factory;
  let spaceCoinLP: SpaceCoinLP;
  let SpaceCoinLPRouter: SpaceCoinLPRouter__factory;
  let spaceCoinLPRouter: SpaceCoinLPRouter;
  let SpaceICO: SpaceICO__factory;
  let spaceICO: SpaceICO;
  let spaceCoin: SpaceCoin;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    [deployer, owner, treasury, alice, bob, caleb] = signers;

    SpaceICO = await ethers.getContractFactory("SpaceICO");
    spaceICO = (await SpaceICO.deploy(
      owner.address,
      treasury.address
    )) as SpaceICO;
    await spaceICO.deployed();

    let spaceCoinAddress = await spaceICO.spaceCoin();
    let SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    spaceCoin = await SpaceCoin.attach(spaceCoinAddress);

    SpaceCoinLP = await ethers.getContractFactory("SpaceCoinLP");
    spaceCoinLP = (await SpaceCoinLP.deploy(spaceCoin.address)) as SpaceCoinLP;
    await spaceCoinLP.deployed();

    SpaceCoinLPRouter = await ethers.getContractFactory("SpaceCoinLPRouter");
    spaceCoinLPRouter = (await SpaceCoinLPRouter.deploy(
      spaceCoinLP.address,
      spaceCoin.address
    )) as SpaceCoinLPRouter;
    await spaceCoinLPRouter.deployed();

    // move ICO forward
    await spaceICO.connect(owner).moveForward(2);

    // setup SpaceICO to be finished & transfer the funds to the SpaceCoinLp contract

    await spaceICO
      .connect(alice)
      .contribute({ value: ethers.utils.parseEther("1000") });
    await spaceICO
      .connect(bob)
      .contribute({ value: ethers.utils.parseEther("1000") });
    for (let i = 0; i < 28; i++) {
      const wallet = signers[5 + i];
      await spaceICO
        .connect(wallet)
        .contribute({ value: ethers.utils.parseEther("1000") });
    }
    expect(await spaceICO.icoAllocationLeft()).to.equal(
      ethers.utils.parseEther("0")
    );

    // turn tax on
    await spaceCoin.connect(owner).setTax(true);

    await spaceICO.connect(owner).transfer(spaceCoinLP.address);
    await spaceCoin
      .connect(treasury)
      .transfer(
        spaceCoinLP.address,
        ethers.utils.parseEther("120000").mul(100).div(98)
      );

    // maths:
    // liquidity: 120_000 SPC, 30_000 ETH
    // alice and bob have 1,000 SPC each
    // k = 10500000000
    // starting liquidity = 60_000
    // 120_000 SPC -> 121_000 SPC
    //
  });

  describe("LP deposits w/ SPC TAX", () => {
    it("Initial liquidity deposit reserves are correct", async () => {
      expect(await spaceCoinLP.totalLiquidity()).to.equal(0);
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      expect(await spaceCoinLP.totalLiquidity()).to.equal(
        ethers.utils.parseEther("60000")
      );
      expect(await spaceCoinLP.reserveSPC()).to.equal(
        ethers.utils.parseEther("120000")
      );
      expect(await spaceCoinLP.reserveETH()).to.equal(
        ethers.utils.parseEther("30000")
      );
    });
    it("Initial liquidity deposit takes out MIN_LIQUIDITY", async () => {
      expect(await spaceCoinLP.totalLiquidity()).to.equal(0);
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      expect(
        await spaceCoinLP.balanceOf(
          "0x0000000000000000000000000000000000000001"
        )
      ).to.equal(1000);
      expect(await spaceCoinLP.balanceOf(caleb.address)).to.equal(
        ethers.utils.parseEther("59999.999999999999999000")
      );
    });
    it("Next liquidity deposit doesn't take out minimum liquidity (eth less)", async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      await spaceCoin
        .connect(alice)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("1000").mul(100).div(98)
        );
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("1000"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("500")
      );
    });
    it("Next liquidity deposit doesn't take out minimum liquidity (spc less)", async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      await spaceCoin
        .connect(alice)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("100").mul(100).div(98)
        );
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("100000"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("50")
      );
    });
  });
  describe("LP burn w/ SPC TAX", () => {
    beforeEach(async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial deposit caleb has "59999.999999999999999000" LP
      await spaceCoin
        .connect(alice)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("100").mul(100).div(98)
        );
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("25"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      // Alice has "50" LP -- should get 100 and 25 back
    });
    it("Able to remove liquidity", async () => {
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("50")
      );
      await spaceCoinLP
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("50"));
      await spaceCoinLP.burn(alice.address);
      // original amount Alice had was 5,000 SPC
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils
          .parseEther("5000")
          .sub(ethers.utils.parseEther("100").mul(100).div(98))
          .add(ethers.utils.parseEther("100").mul(98).div(100))
      );
      expect(await spaceCoinLP.reserveETH()).to.equal(
        ethers.utils.parseEther("30000")
      );
      expect(await spaceCoinLP.reserveSPC()).to.equal(
        ethers.utils.parseEther("120000")
      );
    });
    it("Able to remove all but min liquidity", async () => {
      // alice drain
      expect(await spaceCoinLP.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("50")
      );
      await spaceCoinLP
        .connect(alice)
        .transfer(spaceCoinLP.address, ethers.utils.parseEther("50"));
      await spaceCoinLP.burn(alice.address);
      // caleb drain
      await spaceCoinLP
        .connect(caleb)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("59999.999999999999999000")
        );
      await spaceCoinLP.burn(caleb.address);
      expect(await spaceCoinLP.totalLiquidity()).to.equal(1000);
    });
    it("Not able to burn no liquidity", async () => {
      await expect(spaceCoinLP.burn(alice.address)).to.be.revertedWith(
        "Insufficient liquidity burned"
      );
    });
  });
  describe("LP swap w/ SPC TAX", () => {
    beforeEach(async () => {
      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial LP is 60_000
    });
    it("Able to swap with expected math", async () => {
      // eth is 30_000
      // spc is 120_000
      // k is 3_600_000_000
      // tax is 1%
      // want: 118_800 SPC (lmao)
      // need: to add 3_000_000 ETH
      // these numbers because they're whole numbers with minimal slippage
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("3000000"),
      });
      await spaceCoinLP.swap(
        alice.address,
        ethers.utils.parseEther("118800"),
        0
      );
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      expect(
        reserveETH.mul(reserveSPC).gt(ethers.utils.parseEther("3600000000"))
      ).to.be.ok;
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils
          .parseEther("118800")
          .mul(98)
          .div(100)
          .add(ethers.utils.parseEther("5000"))
      );
    });
  });
});

describe("SpaceCoinLPRouter w/ SPC TAX", () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let caleb: SignerWithAddress;

  let SpaceCoinLP: SpaceCoinLP__factory;
  let spaceCoinLP: SpaceCoinLP;
  let SpaceCoinLPRouter: SpaceCoinLPRouter__factory;
  let spaceCoinLPRouter: SpaceCoinLPRouter;
  let SpaceICO: SpaceICO__factory;
  let spaceICO: SpaceICO;
  let spaceCoin: SpaceCoin;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    [deployer, owner, treasury, alice, bob, caleb] = signers;

    SpaceICO = await ethers.getContractFactory("SpaceICO");
    spaceICO = (await SpaceICO.deploy(
      owner.address,
      treasury.address
    )) as SpaceICO;
    await spaceICO.deployed();

    let spaceCoinAddress = await spaceICO.spaceCoin();
    let SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    spaceCoin = await SpaceCoin.attach(spaceCoinAddress);

    SpaceCoinLP = await ethers.getContractFactory("SpaceCoinLP");
    spaceCoinLP = (await SpaceCoinLP.deploy(spaceCoin.address)) as SpaceCoinLP;
    await spaceCoinLP.deployed();

    SpaceCoinLPRouter = await ethers.getContractFactory("SpaceCoinLPRouter");
    spaceCoinLPRouter = (await SpaceCoinLPRouter.deploy(
      spaceCoinLP.address,
      spaceCoin.address
    )) as SpaceCoinLPRouter;
    await spaceCoinLPRouter.deployed();

    // move ICO forward
    await spaceICO.connect(owner).moveForward(2);

    // setup SpaceICO to be finished & transfer the funds to the SpaceCoinLp contract

    await spaceICO
      .connect(alice)
      .contribute({ value: ethers.utils.parseEther("1000") });
    await spaceICO
      .connect(bob)
      .contribute({ value: ethers.utils.parseEther("1000") });
    for (let i = 0; i < 28; i++) {
      const wallet = signers[5 + i];
      await spaceICO
        .connect(wallet)
        .contribute({ value: ethers.utils.parseEther("1000") });
    }
    expect(await spaceICO.icoAllocationLeft()).to.equal(
      ethers.utils.parseEther("0")
    );

    // turn tax on
    await spaceCoin.connect(owner).setTax(true);
  });
  describe("Router addLiquidity w/ SPC TAX", () => {
    const mintFirst = async () => {
      await spaceICO.connect(owner).transfer(spaceCoinLP.address);
      await spaceCoin
        .connect(treasury)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("120000").mul(100).div(98)
        );
      await spaceCoinLP.connect(caleb).mint(caleb.address);
    };

    it("Able to mint initial amounts", async () => {
      expect(await spaceCoinLP.totalLiquidity()).to.equal(0);
      // first time, we can send in what we want
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(ethers.utils.parseEther("4000").mul(100).div(98), {
          value: ethers.utils.parseEther("4000"),
        });
      expect(await spaceCoinLP.totalLiquidity()).to.equal(
        ethers.utils.parseEther("4000")
      );
    });
    it("Able to mint spc leading amounts", async () => {
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("5000");
      let matchingEther = await spaceCoinLPRouter.matchLiquidity(
        goalSPC,
        reserveSPC,
        reserveETH,
        totalLiquidity,
        true,
        true
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(goalSPC, { value: matchingEther });
      expect((await spaceCoinLP.balanceOf(alice.address)).gt(0)).to.be.ok;
    });
    it("Able to mint eth leading amounts", async () => {
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalETH = ethers.utils.parseEther("5");
      let matchingSPC = await spaceCoinLPRouter.matchLiquidity(
        goalETH,
        reserveETH,
        reserveSPC,
        totalLiquidity,
        true,
        false
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, matchingSPC);
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(0, { value: goalETH });
      expect((await spaceCoinLP.balanceOf(alice.address)).gt(0)).to.be.ok;
    });
    it("Will revert if not enough SPC approved", async () => {
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalETH = ethers.utils.parseEther("5000");
      let matchingSPC = await spaceCoinLPRouter.matchLiquidity(
        goalETH,
        reserveETH,
        reserveSPC,
        totalLiquidity,
        true,
        false
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, matchingSPC);
      await expect(
        spaceCoinLPRouter.connect(alice).addLiquidity(0, { value: goalETH })
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
    });
    it("Will revert if not enough ETH", async () => {
      // figure out how much to send in
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("5000");
      let matchingEther = await spaceCoinLPRouter.matchLiquidity(
        goalSPC,
        reserveSPC,
        reserveETH,
        totalLiquidity,
        true,
        true
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await expect(
        spaceCoinLPRouter
          .connect(alice)
          .addLiquidity(goalSPC, { value: matchingEther.sub(3) })
      ).to.revertedWith("ETH transfer failed");
    });
    it("Will return extra ETH", async () => {
      // figure out how much to send in
      await mintFirst();
      let reserveETH = await spaceCoinLP.reserveETH();
      let reserveSPC = await spaceCoinLP.reserveSPC();
      let totalLiquidity = await spaceCoinLP.totalLiquidity();
      let goalSPC = ethers.utils.parseEther("5000");
      let matchingEther = await spaceCoinLPRouter.matchLiquidity(
        goalSPC,
        reserveSPC,
        reserveETH,
        totalLiquidity,
        true,
        true
      );
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("5000"));
      await spaceCoinLPRouter
        .connect(alice)
        .addLiquidity(goalSPC, { value: matchingEther.add(1) });
    });
  });
  describe("Router burnLiquidity w/ SPC TAX", () => {
    beforeEach(async () => {
      // add initial liquidity
      await spaceICO.connect(owner).transfer(spaceCoinLP.address);
      await spaceCoin
        .connect(treasury)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("120000").mul(100).div(98)
        );

      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial deposit caleb has "59999.999999999999999000" LP
      await spaceCoin
        .connect(alice)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("100").mul(100).div(98)
        );
      await alice.sendTransaction({
        to: spaceCoinLP.address,
        value: ethers.utils.parseEther("25"),
      });
      await spaceCoinLP.connect(alice).mint(alice.address);
      // Alice has "50" LP -- should get 100 and 25 back
    });
    it("Able to burn and get back liquidity", async () => {
      let lpAmount = await spaceCoinLP.balanceOf(alice.address);
      await spaceCoinLP
        .connect(alice)
        .approve(spaceCoinLPRouter.address, lpAmount);
      await spaceCoinLPRouter.connect(alice).burnLiquidity(lpAmount);
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils
          .parseEther("5000")
          .sub(ethers.utils.parseEther("100").mul(100).div(98))
          .add(ethers.utils.parseEther("100").mul(98).div(100))
      );
    });
  });
  describe("Router swap w/ SPC TAX", () => {
    beforeEach(async () => {
      // add initial liquidity
      await spaceICO.connect(owner).transfer(spaceCoinLP.address);
      await spaceCoin
        .connect(treasury)
        .transfer(
          spaceCoinLP.address,
          ethers.utils.parseEther("120000").mul(100).div(98)
        );

      await spaceCoinLP.connect(caleb).mint(caleb.address);
      // initial deposit caleb has "59999.999999999999999000" LP
    });

    it("Swapping ETH for SPC works", async () => {
      await spaceCoinLPRouter
        .connect(alice)
        .swap(0, ethers.utils.parseEther("1"), ethers.utils.parseEther("4.5"), {
          value: ethers.utils.parseEther("1000"),
        }); // price is 4
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5001")
      );
    });
    it("Swapping ETH for SPC works", async () => {
      await spaceCoinLPRouter
        .connect(alice)
        .swap(
          0,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("600"),
          {
            value: ethers.utils.parseEther("1000"),
          }
        ); // price is 4
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5010")
      );
    });
    it("Swapping ETH for SPC works", async () => {
      await spaceCoinLPRouter
        .connect(alice)
        .swap(0, 1, ethers.utils.parseEther("600"), {
          value: ethers.utils.parseEther("1000"),
        });
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("5000.000000000000000001")
      );
    });
    it("Swapping SPC for ETH works", async () => {
      await spaceCoin
        .connect(alice)
        .approve(spaceCoinLPRouter.address, ethers.utils.parseEther("70"));
      await spaceCoinLPRouter
        .connect(alice)
        .swap(ethers.utils.parseEther("7"), 0, ethers.utils.parseEther("70"), {
          value: ethers.utils.parseEther("1000"),
        }); // price is 4
      expect(await spaceCoin.balanceOf(alice.address)).to.be.lt(
        ethers.utils.parseEther("5000")
      );
    });
  });
});
