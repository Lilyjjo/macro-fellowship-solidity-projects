import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  CollectorDAO,
  CollectorDAO__factory,
  ToyNFTMarketPlace,
  ToyNFTMarketPlace__factory,
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

describe("CollectorDAO", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let caleb: SignerWithAddress;

  let CollectorDAO: CollectorDAO__factory;
  let collectorDAO: CollectorDAO;
  let ToyNFTMarketPlace: ToyNFTMarketPlace__factory;
  let toyNFTMarketPlace: ToyNFTMarketPlace;

  let domain = {
    name: "CollectorDAO",
    version: "1",
    chainId: 31337,
    verifyingContract: "",
  };

  const types = {
    VoteStatus: [
      { name: "vote", type: "bool" },
      { name: "proposalID", type: "uint256" },
    ],
  };

  beforeEach(async () => {
    [deployer, alice, bob, caleb] = await ethers.getSigners();

    CollectorDAO = await ethers.getContractFactory("CollectorDAO");
    collectorDAO = (await CollectorDAO.deploy()) as CollectorDAO;
    await collectorDAO.deployed();

    ToyNFTMarketPlace = await ethers.getContractFactory("ToyNFTMarketPlace");
    toyNFTMarketPlace = (await ToyNFTMarketPlace.deploy()) as ToyNFTMarketPlace;
    await toyNFTMarketPlace.deployed();

    domain.verifyingContract = collectorDAO.address;
  });

  describe("Members", () => {
    it("Any address can become a member", async () => {
      expect(await collectorDAO.members(deployer.address)).to.equal(false);
      await collectorDAO.buyMembership({ value: ethers.utils.parseEther("1") });
      expect(await collectorDAO.members(deployer.address)).to.equal(true);
    });
    it("An address can only become a member once", async () => {
      expect(await collectorDAO.members(deployer.address)).to.equal(false);
      await collectorDAO.buyMembership({ value: ethers.utils.parseEther("1") });
      await expect(
        collectorDAO.buyMembership({ value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Already a member");
    });
    it("Only 1 ETH is accepted for membership", async () => {
      await expect(
        collectorDAO.buyMembership({ value: ethers.utils.parseEther("0.9") })
      ).to.be.revertedWith("Expected 1 ETH to be sent");
      await expect(
        collectorDAO.buyMembership({ value: ethers.utils.parseEther("1.1") })
      ).to.be.revertedWith("Expected 1 ETH to be sent");
    });
  });

  describe("NFT Proposals", () => {
    beforeEach(async () => {
      await collectorDAO
        .connect(deployer)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(alice)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(bob)
        .buyMembership({ value: ethers.utils.parseEther("1") });
    });
    it("A member can make an NFT proposal", async () => {
      await collectorDAO.nftProposal(
        toyNFTMarketPlace.address,
        toyNFTMarketPlace.address,
        0,
        ethers.utils.parseEther("2"),
        { value: ethers.utils.parseEther("0.001") }
      );

      expect(await collectorDAO.proposalStatus(1)).to.equal(0);
    });
    it("NFT proposals can buy NFTs", async () => {
      await collectorDAO.nftProposal(
        toyNFTMarketPlace.address,
        toyNFTMarketPlace.address,
        0,
        ethers.utils.parseEther("1"),
        { value: ethers.utils.parseEther("0.001") }
      );

      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);

      // can execute proposal
      expect(await toyNFTMarketPlace.balanceOf(collectorDAO.address)).to.equal(
        0
      );
      await collectorDAO.execute(1);
      expect(await toyNFTMarketPlace.balanceOf(collectorDAO.address)).to.equal(
        1
      );
    });
    it("Underpriced NFT proposals will fail", async () => {
      // price of NFT is 1 ETH
      await collectorDAO.nftProposal(
        toyNFTMarketPlace.address,
        toyNFTMarketPlace.address,
        0,
        ethers.utils.parseEther(".01"),
        { value: ethers.utils.parseEther("0.001") }
      );

      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);

      // proposal will fail to execute
      await expect(collectorDAO.execute(1)).to.be.revertedWith(
        "Transaction failed"
      );
    });
    it("Only contract can call _nftProposal()", async () => {
      await expect(
        collectorDAO._nftProposal(
          toyNFTMarketPlace.address,
          toyNFTMarketPlace.address,
          0,
          ethers.utils.parseEther("1")
        )
      ).to.be.revertedWith("Only callable via nftProposal()");
    });
    it("NFT Marketplace Transaction can return false", async () => {
      await collectorDAO.nftProposal(
        toyNFTMarketPlace.address,
        toyNFTMarketPlace.address,
        42,
        ethers.utils.parseEther("1"),
        { value: ethers.utils.parseEther("0.001") }
      );

      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);

      // proposal will fail to execute
      await expect(collectorDAO.execute(1)).to.be.revertedWith(
        "Transaction failed"
      );
    });
    it("NFT Marketplace Transaction can revert", async () => {
      await collectorDAO.nftProposal(
        toyNFTMarketPlace.address,
        toyNFTMarketPlace.address,
        24,
        ethers.utils.parseEther("1"),
        { value: ethers.utils.parseEther("0.001") }
      );

      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);

      // proposal will fail to execute
      await expect(collectorDAO.execute(1)).to.be.revertedWith(
        "Transaction failed"
      );
    });
  });

  describe("Generic Proposals", () => {
    beforeEach(async () => {
      await collectorDAO
        .connect(deployer)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(alice)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(bob)
        .buyMembership({ value: ethers.utils.parseEther("1") });
    });

    it("It costs 0.1 ETH to submit a proposal", async () => {
      await expect(
        collectorDAO.makeProposal([], [], [], [], {
          value: ethers.utils.parseEther("0.01"),
        })
      ).to.be.revertedWith("Expected .001 ETH to be sent");
    });
    it("Only members can propose", async () => {
      await expect(
        collectorDAO.connect(caleb).makeProposal([], [], [], [], {
          value: ethers.utils.parseEther("0.001"),
        })
      ).to.be.revertedWith("Only members can propose");
    });
    it("Cannot have an empty proposal", async () => {
      await expect(
        collectorDAO.makeProposal([], [], [], [], {
          value: ethers.utils.parseEther("0.001"),
        })
      ).to.be.revertedWith("Empty proposal");
    });
    it("Cannot have data length mismatch", async () => {
      await expect(
        collectorDAO.makeProposal([deployer.address], [], [], [], {
          value: ethers.utils.parseEther("0.001"),
        })
      ).to.be.revertedWith("Data length mismatch");
    });
    it("Can only execute proposals in EXECUTE state", async () => {
      let targets = [toyNFTMarketPlace.address];
      let values = ["0"];
      let signatures = ["bumpCall()"];
      let calldatas = ["0x"];

      await collectorDAO.makeProposal(targets, values, signatures, calldatas, {
        value: ethers.utils.parseEther("0.001"),
      });

      await expect(collectorDAO.execute(1)).to.be.revertedWith(
        "Proposal not in execution state"
      );
    });

    it("A member can make a multi-step proposal that passes", async () => {
      // first proposal, no call data
      let targets = [toyNFTMarketPlace.address];
      let values = ["0"];
      let signatures = ["bumpCall()"];
      let calldatas = ["0x"];

      // second proposal, manually buy an NFT
      targets.push(toyNFTMarketPlace.address);
      values.push(ethers.utils.parseEther("1").toString());
      signatures.push("buy(address,uint256)");
      calldatas.push(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "uint256"],
          [alice.address, 22]
        )
      );

      // third proposal, send alice ETH
      targets.push(alice.address);
      values.push(ethers.utils.parseEther("1").toString());
      signatures.push("");
      calldatas.push("0x");

      // submit proposal
      await collectorDAO.makeProposal(targets, values, signatures, calldatas, {
        value: ethers.utils.parseEther("0.001"),
      });
      expect(await collectorDAO.proposalStatus(1)).to.equal(0);

      // members can vote and reach quorum
      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);

      // can execute proposal
      expect(await toyNFTMarketPlace.bumpCalled()).to.equal(0);
      expect(await toyNFTMarketPlace.balanceOf(collectorDAO.address)).to.equal(
        0
      );
      await collectorDAO.execute(1);
      expect(await toyNFTMarketPlace.bumpCalled()).to.equal(1);
      expect(await toyNFTMarketPlace.balanceOf(collectorDAO.address)).to.equal(
        1
      );
    });
  });

  describe("Proposal States", () => {
    beforeEach(async () => {
      await collectorDAO
        .connect(deployer)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(alice)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(bob)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(caleb)
        .buyMembership({ value: ethers.utils.parseEther("1") });

      let targets = [toyNFTMarketPlace.address];
      let values = ["0"];
      let signatures = ["bumpCall()"];
      let calldatas = ["0x"];

      await collectorDAO.makeProposal(targets, values, signatures, calldatas, {
        value: ethers.utils.parseEther("0.001"),
      });
    });
    it("Cannot get state of non-existant proposal", async () => {
      await expect(collectorDAO.proposalStatus(0)).to.revertedWith(
        "Not a valid proposal"
      );
    });
    it("Can reach state 'VOTING'", async () => {
      expect(await collectorDAO.proposalStatus(1)).to.equal(0);
    });
    it("Can reach state 'EXECUTION'", async () => {
      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);
      expect(await collectorDAO.proposalStatus(1)).to.equal(1);
    });
    it("Can reach state 'EXECUTED'", async () => {
      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 8);
      await collectorDAO.connect(deployer).execute(1);
      expect(await collectorDAO.proposalStatus(1)).to.equal(2);
    });
    it("Can reach state 'QUORUM_NOT_MET'", async () => {
      await timeTravel(SECONDS_IN_DAY * 8);
      expect(await collectorDAO.proposalStatus(1)).to.equal(3);
    });
    it("Can reach state 'FAILED'", async () => {
      await collectorDAO.connect(deployer).voteOnChain(false, 1);
      await timeTravel(SECONDS_IN_DAY * 8);
      expect(await collectorDAO.proposalStatus(1)).to.equal(4);
    });
    it("Can reach state 'EXPIRED'", async () => {
      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await timeTravel(SECONDS_IN_DAY * 16);
      expect(await collectorDAO.proposalStatus(1)).to.equal(5);
    });
  });

  describe("Voting", () => {
    beforeEach(async () => {
      await collectorDAO
        .connect(deployer)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(alice)
        .buyMembership({ value: ethers.utils.parseEther("1") });
      await collectorDAO
        .connect(bob)
        .buyMembership({ value: ethers.utils.parseEther("1") });

      let targets = [toyNFTMarketPlace.address];
      let values = ["0"];
      let signatures = ["bumpCall()"];
      let calldatas = ["0x"];

      await collectorDAO.makeProposal(targets, values, signatures, calldatas, {
        value: ethers.utils.parseEther("0.001"),
      });
    });
    it("Can vote onchain", async () => {
      // members can vote and reach quorum
      await collectorDAO.connect(deployer).voteOnChain(true, 1);
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 2);
    });
    it("Can vote offchain", async () => {
      const vote = {
        vote: true,
        proposalID: "1",
      };

      const signature = await alice._signTypedData(domain, types, vote);
      const expectedSignerAddress = alice.address;
      const recoveredAddress = ethers.utils.verifyTypedData(
        domain,
        types,
        vote,
        signature
      );
      let sig = ethers.utils.splitSignature(signature);

      await collectorDAO
        .connect(alice)
        .voteOffChain(true, 1, sig.v, sig.r, sig.s);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 1);
    });
    it("Can bulk vote offchain", async () => {
      const voteYes = {
        vote: true,
        proposalID: "1",
      };
      const voteNo = {
        vote: false,
        proposalID: "1",
      };

      const signatureAlice = await alice._signTypedData(domain, types, voteYes);
      const signatureBob = await bob._signTypedData(domain, types, voteNo);

      let sigAlice = ethers.utils.splitSignature(signatureAlice);
      let sigBob = ethers.utils.splitSignature(signatureBob);

      let proposalIDs = [1, 1];
      let votes = [true, false];
      let vs = [sigAlice.v, sigBob.v];
      let rs = [sigAlice.r, sigBob.r];
      let ss = [sigAlice.s, sigBob.s];

      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 1);
      expect((await collectorDAO.proposals(1)).voteNo.toNumber() == 1);
    });
    it("OnChain: Can't vote past voting period", async () => {
      await timeTravel(SECONDS_IN_DAY * 8);
      await expect(
        collectorDAO.connect(deployer).voteOnChain(true, 1)
      ).to.be.revertedWith("Not in voting stage");
    });
    it("OnChain: Can't change vote", async () => {
      collectorDAO.connect(deployer).voteOnChain(true, 1);
      await expect(
        collectorDAO.connect(deployer).voteOnChain(true, 1)
      ).to.be.revertedWith("Already voted");
    });
    it("OnChain: Must be member to vote", async () => {
      await expect(
        collectorDAO.connect(caleb).voteOnChain(true, 1)
      ).to.be.revertedWith("Not a member, cannot vote");
    });
    it("OnChain: Can't vote non existing proposal", async () => {
      await expect(
        collectorDAO.connect(deployer).voteOnChain(true, 2)
      ).to.be.revertedWith("Invalid proposalID");
    });
    it("OffChain Single: Can't vote past voting period", async () => {
      await timeTravel(SECONDS_IN_DAY * 8);

      const vote = {
        vote: true,
        proposalID: "1",
      };

      const signature = await alice._signTypedData(domain, types, vote);
      const expectedSignerAddress = alice.address;
      const recoveredAddress = ethers.utils.verifyTypedData(
        domain,
        types,
        vote,
        signature
      );
      let sig = ethers.utils.splitSignature(signature);

      await expect(
        collectorDAO.voteOffChain(true, 1, sig.v, sig.r, sig.s)
      ).to.be.revertedWith("Not in voting stage");
    });
    it("OffChain Single: Can't vote non existing proposals", async () => {
      await timeTravel(SECONDS_IN_DAY * 8);

      const vote = {
        vote: true,
        proposalID: "2",
      };

      const signature = await alice._signTypedData(domain, types, vote);
      let sig = ethers.utils.splitSignature(signature);

      await expect(
        collectorDAO.voteOffChain(true, 2, sig.v, sig.r, sig.s)
      ).to.be.revertedWith("Invalid proposalID");
    });
    it("OffChain Single: Must be member to vote", async () => {
      const vote = {
        vote: true,
        proposalID: "1",
      };

      const signature = await caleb._signTypedData(domain, types, vote);
      let sig = ethers.utils.splitSignature(signature);

      await expect(
        collectorDAO.voteOffChain(true, 1, sig.v, sig.r, sig.s)
      ).to.be.revertedWith("Not a member, cannot vote");
    });
    it("OffChain Single: Can't change vote", async () => {
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      const vote = {
        vote: true,
        proposalID: "1",
      };

      const signature = await alice._signTypedData(domain, types, vote);
      let sig = ethers.utils.splitSignature(signature);

      await expect(
        collectorDAO.voteOffChain(true, 1, sig.v, sig.r, sig.s)
      ).to.be.revertedWith("Already voted");
    });
    it("OffChain Single: Signature expired", async () => {
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      const vote = {
        vote: false,
        proposalID: "1",
      };

      const signature = await alice._signTypedData(domain, types, vote);
      let sig = ethers.utils.splitSignature(signature);

      await expect(
        collectorDAO.voteOffChain(false, 1, sig.v, sig.r, sig.s)
      ).to.be.revertedWith("Already voted");
    });
    it("OffChain Bulk: Can't vote past voting period", async () => {
      await timeTravel(SECONDS_IN_DAY * 8);
      const voteYes = {
        vote: true,
        proposalID: "1",
      };

      const voteNo = {
        vote: false,
        proposalID: "1",
      };

      const signatureAlice = await alice._signTypedData(domain, types, voteYes);
      const signatureBob = await bob._signTypedData(domain, types, voteNo);

      let sigAlice = ethers.utils.splitSignature(signatureAlice);
      let sigBob = ethers.utils.splitSignature(signatureBob);

      let proposalIDs = [1, 1];
      let votes = [true, false];
      let vs = [sigAlice.v, sigBob.v];
      let rs = [sigAlice.r, sigBob.r];
      let ss = [sigAlice.s, sigBob.s];

      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 0);
      expect((await collectorDAO.proposals(1)).voteNo.toNumber() == 0);
    });
    it("OffChain Bulk: Must be member to vote", async () => {
      const voteYes = {
        vote: true,
        proposalID: "1",
      };
      const voteNo = {
        vote: false,
        proposalID: "1",
      };

      const signatureCaleb = await caleb._signTypedData(domain, types, voteYes);
      const signatureBob = await bob._signTypedData(domain, types, voteNo);

      let sigCaleb = ethers.utils.splitSignature(signatureCaleb);
      let sigBob = ethers.utils.splitSignature(signatureBob);

      let proposalIDs = [1, 1];
      let votes = [true, false];
      let vs = [sigCaleb.v, sigBob.v];
      let rs = [sigCaleb.r, sigBob.r];
      let ss = [sigCaleb.s, sigBob.s];

      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 1);
      expect((await collectorDAO.proposals(1)).voteNo.toNumber() == 0);
    });
    it("OffChain Bulk: Can't vote on non existing proposals", async () => {
      const voteYes = {
        vote: true,
        proposalID: "2",
      };
      const signatureAlice = await alice._signTypedData(domain, types, voteYes);

      let sigAlice = ethers.utils.splitSignature(signatureAlice);

      let proposalIDs = [2];
      let votes = [true];
      let vs = [sigAlice.v];
      let rs = [sigAlice.r];
      let ss = [sigAlice.s];

      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(2)).voteYes.toNumber() == 0);
    });
    it("OffChain Bulk: Can't vote same vote", async () => {
      await collectorDAO.connect(alice).voteOnChain(true, 1);
      const voteYes = {
        vote: "true",
        proposalID: "1",
      };
      const signatureAlice = await alice._signTypedData(domain, types, voteYes);
      let sigAlice = ethers.utils.splitSignature(signatureAlice);

      let proposalIDs = [2];
      let votes = [true];
      let vs = [sigAlice.v];
      let rs = [sigAlice.r];
      let ss = [sigAlice.s];

      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 1);
      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 0);
    });
    it("OffChain Bulk: Signature Expired", async () => {
      const voteYes = {
        vote: "true",
        proposalID: "1",
      };
      const signatureAlice = await alice._signTypedData(domain, types, voteYes);
      let sigAlice = ethers.utils.splitSignature(signatureAlice);

      let proposalIDs = [1];
      let votes = [true];
      let vs = [sigAlice.v];
      let rs = [sigAlice.r];
      let ss = [sigAlice.s];

      await collectorDAO.connect(alice).voteOnChain(false, 1);
      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 0);
      expect((await collectorDAO.proposals(1)).voteNo.toNumber() == 1);
    });
    it("OffChain Bulk: Can vote on different proposals", async () => {
      let targets = [toyNFTMarketPlace.address];
      let values = ["0"];
      let signatures = ["bumpCall()"];
      let calldatas = ["0x"];

      await collectorDAO.makeProposal(targets, values, signatures, calldatas, {
        value: ethers.utils.parseEther("0.001"),
      });

      const voteYes = {
        vote: true,
        proposalID: "1",
      };
      const voteNo = {
        vote: false,
        proposalID: "2",
      };

      const signatureAlice = await alice._signTypedData(domain, types, voteYes);
      const signatureBob = await bob._signTypedData(domain, types, voteNo);

      let sigAlice = ethers.utils.splitSignature(signatureAlice);
      let sigBob = ethers.utils.splitSignature(signatureBob);

      let proposalIDs = [1, 2];
      let votes = [true, false];
      let vs = [sigAlice.v, sigBob.v];
      let rs = [sigAlice.r, sigBob.r];
      let ss = [sigAlice.s, sigBob.s];

      await collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss);

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 1);
      expect((await collectorDAO.proposals(2)).voteNo.toNumber() == 1);
    });
    it("OffChain Bulk: wrong parameter length", async () => {
      let targets = [toyNFTMarketPlace.address];
      let values = ["0"];
      let signatures = ["bumpCall()"];
      let calldatas = ["0x"];

      await collectorDAO.makeProposal(targets, values, signatures, calldatas, {
        value: ethers.utils.parseEther("0.001"),
      });

      const voteYes = {
        vote: true,
        proposalID: "1",
      };
      const voteNo = {
        vote: false,
        proposalID: "2",
      };

      const signatureAlice = await alice._signTypedData(domain, types, voteYes);
      const signatureBob = await bob._signTypedData(domain, types, voteNo);

      let sigAlice = ethers.utils.splitSignature(signatureAlice);
      let sigBob = ethers.utils.splitSignature(signatureBob);

      let proposalIDs = [1, 2];
      let votes = [true];
      let vs = [sigAlice.v, sigBob.v];
      let rs = [sigAlice.r, sigBob.r];
      let ss = [sigAlice.s, sigBob.s];

      await expect(
        collectorDAO.voteOffChainBulk(votes, proposalIDs, vs, rs, ss)
      ).to.revertedWith("Data length mismatch");

      expect((await collectorDAO.proposals(1)).voteYes.toNumber() == 1);
      expect((await collectorDAO.proposals(2)).voteNo.toNumber() == 1);
    });
  });

  describe("", () => {
    it("", async () => {
      expect(true).to.be.ok;
    });
  });
});
