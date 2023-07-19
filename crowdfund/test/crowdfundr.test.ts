// ----------------------------------------------------------------------------
// REQUIRED: Instructions
// ----------------------------------------------------------------------------
/*
  For this first project, we've provided a significant amount of scaffolding
  in your test suite. We've done this to:

    1. Set expectations, by example, of where the bar for testing is.
    2. Encourage more students to embrace an Advanced Typescript Hardhat setup.
    3. Reduce the amount of time consumed this week by "getting started friction".

  Please note that:

    - We will not be so generous on future projects!
    - The tests provided are about ~90% complete.
    - IMPORTANT:
      - We've intentionally left out some tests that would reveal potential
        vulnerabilities you'll need to identify, solve for, AND TEST FOR!

      - Failing to address these vulnerabilities will leave your contracts
        exposed to hacks, and will certainly result in extra points being
        added to your micro-audit report! (Extra points are _bad_.)

  Your job (in this file):

    - DO NOT delete or change the test names for the tests provided
    - DO complete the testing logic inside each tests' callback function
    - DO add additional tests to test how you're securing your smart contracts
         against potential vulnerabilties you identify as you work through the
         project.

    - You will also find several places where "FILL_ME_IN" has been left for
      you. In those places, delete the "FILL_ME_IN" text, and replace with
      whatever is appropriate.
*/
// ----------------------------------------------------------------------------

import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Project, ProjectFactory, ProjectFactory__factory } from "../typechain";

// ----------------------------------------------------------------------------
// OPTIONAL: Constants and Helper Functions
// ----------------------------------------------------------------------------
// We've put these here for your convenience. Feel free to use them if they
// are helpful!
const SECONDS_IN_DAY: number = 60 * 60 * 24;
const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");

// Bump the timestamp by a specific amount of seconds
const timeTravel = async (seconds: number) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

// ----------------------------------------------------------------------------

describe("Crowdfundr", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let ProjectFactory: ProjectFactory__factory;
  let projectFactory: ProjectFactory;

  beforeEach(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    // NOTE: You may need to pass arguments to the `deploy` function if your
    //       ProjectFactory contract's constructor has input parameters
    ProjectFactory = await ethers.getContractFactory("ProjectFactory");
    projectFactory =
      (await ProjectFactory.deploy(/* FILL_ME_IN: */)) as ProjectFactory;
    await projectFactory.deployed();
  });

  describe("ProjectFactory: Additional Tests", () => {
    /* 
      TODO: You may add additional tests here if you need to

      NOTE: If you wind up writing Solidity code to protect against a
            vulnerability that is not tested for below, you should add
            at least one test here.

      DO NOT: Delete or change the test names for the tests provided below
    */
    it("Project's goal must be at least 0.01 ETH", async () => {
      await expect(
        projectFactory.create(
          ethers.utils.parseEther("0.009"),
          "Project1",
          "PR1"
        )
      ).to.be.revertedWith("Minimum goal amount of .01 ETH required.");
    });
  });

  describe("ProjectFactory", () => {
    it("Deploys a contract", () => {
      expect(projectFactory.address).to.be.ok;
    });

    it("Can register a single project", async () => {
      const txReceiptUnresolved = await projectFactory.create(
        ONE_ETHER,
        "Project1",
        "PR1"
      );
      const txReceipt = await txReceiptUnresolved.wait();

      const projectAddress: string = txReceipt.events![1].args![0];
      const project = await ethers.getContractAt("Project", projectAddress);
      expect(project.address).to.be.ok;
    });

    it("Can register multiple projects", async () => {
      const txReceiptUnresolved = await projectFactory.create(
        ONE_ETHER,
        "Project1",
        "PR1"
      );
      const txReceipt = await txReceiptUnresolved.wait();

      const projectAddress: string = txReceipt.events![1].args![0];
      const project = await ethers.getContractAt("Project", projectAddress);
      expect(project.address).to.be.ok;

      const txReceiptUnresolved2 = await projectFactory.create(
        ONE_ETHER,
        "Project2",
        "PR2"
      );
      const txReceipt2 = await txReceiptUnresolved2.wait();

      const projectAddress2: string = txReceipt2.events![1].args![0];
      const project2 = await ethers.getContractAt("Project", projectAddress2);
      expect(project2.address).to.be.ok;
    });

    it("Registers projects with the correct owner", async () => {
      const txReceiptUnresolved = await projectFactory
        .connect(alice)
        .create(ONE_ETHER, "Project1", "PR1");
      const txReceipt = await txReceiptUnresolved.wait();

      const projectAddress: string = txReceipt.events![1].args![0];
      const project = await ethers.getContractAt("Project", projectAddress);

      expect(await project.getCreator()).to.equal(alice.address);
    });

    it("Registers projects with a preset funding goal (in units of ether)", async () => {
      const txReceiptUnresolved = await projectFactory
        .connect(alice)
        .create(ONE_ETHER, "Project1", "PR1");
      const txReceipt = await txReceiptUnresolved.wait();

      const projectAddress: string = txReceipt.events![1].args![0];
      const project = await ethers.getContractAt("Project", projectAddress);

      expect(await project.getGoalAmount()).to.equal(ONE_ETHER);
    });

    it('Emits a "ProjectCreated" event after registering a project', async () => {
      const txReceiptUnresolved = await projectFactory
        .connect(alice)
        .create(ONE_ETHER, "Project1", "PR1");
      const txReceipt = await txReceiptUnresolved.wait();

      const projectAddress: string = txReceipt.events![1].args![0];
      const project = await ethers.getContractAt("Project", projectAddress);

      expect(await project.getGoalAmount()).to.equal(ONE_ETHER);
    });

    it("Allows multiple contracts to accept ETH simultaneously", async () => {
      const txReceiptUnresolved = await projectFactory.create(
        ONE_ETHER,
        "Project1",
        "PR1"
      );
      const txReceipt = await txReceiptUnresolved.wait();

      const projectAddress: string = txReceipt.events![1].args![0];
      const project = await ethers.getContractAt("Project", projectAddress);

      const txReceiptUnresolved2 = await projectFactory.create(
        ONE_ETHER,
        "Project1",
        "PR1"
      );
      const txReceipt2 = await txReceiptUnresolved2.wait();

      const projectAddress2: string = txReceipt2.events![1].args![0];
      const project2 = await ethers.getContractAt("Project", projectAddress2);

      expect(
        await project
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther(".01") })
      );
      expect(
        await project2
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther(".01") })
      );
    });
  });

  describe("Project: Additional Tests", () => {
    /* 
      TODO: You may add additional tests here if you need to

      NOTE: If you wind up protecting against a vulnerability that is not
            tested for below, you should add at least one test here.

      DO NOT: Delete or change the test names for the tests provided below
    */
    let projectAddress: string;
    let project: Project;

    beforeEach(async () => {
      // TODO: Your ProjectFactory contract will need a `create` method, to
      //       create new Projects
      const txReceiptUnresolved = await projectFactory
        .connect(deployer)
        .create(ONE_ETHER, "Project1", "PR1");
      const txReceipt = await txReceiptUnresolved.wait();

      projectAddress = txReceipt.events![1].args![0];
      project = await ethers.getContractAt("Project", projectAddress);
    });

    it("Only the creator can cancell their projects.", async () => {
      await expect(project.connect(alice).cancel()).to.be.revertedWith(
        "Only the creator can call"
      );
    });

    it("Can award multiple badges for a single contribution", async () => {
      expect(await project.balanceOf(alice.address)).to.equal(0);
      await project
        .connect(alice)
        .contribute({ value: ethers.utils.parseEther(".01") });
      await project
        .connect(alice)
        .contribute({ value: ethers.utils.parseEther("4") });
      expect(await project.balanceOf(alice.address)).to.equal(4);
    });

    it("Prevents contributors from being refunded twice", async () => {
      await project
        .connect(alice)
        .contribute({ value: ethers.utils.parseEther(".01") });
      timeTravel(SECONDS_IN_DAY * 30);
      await project.connect(alice).refund();
      await expect(project.connect(alice).refund()).to.be.revertedWith(
        "No funds to reclaim."
      );
    });
    it('Emits a "ProjectSuccess" event after the project reaches it\'s funding goal', async () => {
      const txReceiptUnresolved = await project
        .connect(alice)
        .contribute({ value: ethers.utils.parseEther("1") });
      const txReceipt = await txReceiptUnresolved.wait();
      expect(txReceipt.events![1].event).to.equal("ProjectSuccess");
    });
  });

  describe("Project", () => {
    let projectAddress: string;
    let project: Project;

    beforeEach(async () => {
      // TODO: Your ProjectFactory contract will need a `create` method, to
      //       create new Projects
      const txReceiptUnresolved = await projectFactory
        .connect(deployer)
        .create(ONE_ETHER, "Project1", "PR1");
      const txReceipt = await txReceiptUnresolved.wait();

      projectAddress = txReceipt.events![1].args![0];
      project = await ethers.getContractAt("Project", projectAddress);
    });

    describe("Contributions", () => {
      describe("Contributors", () => {
        it("Allows the creator to contribute", async () => {
          expect(
            await project
              .connect(deployer)
              .contribute({ value: ethers.utils.parseEther("0.02") })
          );
          expect(await project.getCurrentAmount()).to.equal(
            ethers.utils.parseEther("0.02")
          );
        });

        it("Allows any EOA to contribute", async () => {
          expect(
            await project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          );
          expect(await project.getCurrentAmount()).to.equal(
            ethers.utils.parseEther("0.01")
          );
        });

        it("Allows an EOA to make many separate contributions", async () => {
          expect(
            await project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          );
          expect(
            await project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          );
          expect(
            await project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          );
          expect(await project.getCurrentAmount()).to.equal(
            ethers.utils.parseEther("0.03")
          );
        });

        it('Emits a "Contribution" event after a contribution is made', async () => {
          const txReceiptUnresolved = await project.contribute({
            value: ethers.utils.parseEther("0.01"),
          });
          const txReceipt = await txReceiptUnresolved.wait();
          expect(txReceipt.events![0].event).to.equal("Contribution");
          expect(txReceipt.events![0].args![0]).to.equal(deployer.address);
          expect(txReceipt.events![0].args![1]).to.equal(
            ethers.utils.parseEther("0.01")
          );
        });
      });

      describe("Minimum ETH Per Contribution", () => {
        it("Reverts contributions below 0.01 ETH", async () => {
          await expect(
            project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.009") })
          ).to.be.revertedWith(
            "Minimum contribution amount of .01 ETH not met."
          );
        });

        it("Accepts contributions of exactly 0.01 ETH", async () => {
          expect(
            await project
              .connect(deployer)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          );
          expect(await project.getCurrentAmount()).to.equal(
            ethers.utils.parseEther("0.01")
          );
        });
      });

      describe("Final Contributions", () => {
        it("Allows the final contribution to exceed the project funding goal", async () => {
          expect(
            await project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("4") })
          );
          expect(await project.getCurrentAmount()).to.equal(
            ethers.utils.parseEther("4")
          );
        });

        it("Prevents additional contributions after a project is fully funded", async () => {
          expect(
            await project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("4") })
          );
          await expect(
            project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          ).to.be.revertedWith("Project not accepting contribtuions anymore.");
        });

        it("Prevents additional contributions after 30 days have passed since Project instance deployment", async () => {
          timeTravel(SECONDS_IN_DAY * 30);
          await expect(
            project
              .connect(alice)
              .contribute({ value: ethers.utils.parseEther("0.01") })
          ).to.be.revertedWith("Project not accepting contribtuions anymore.");
        });
      });
    });

    describe("Withdrawals", () => {
      describe("Project Status: Active", () => {
        it("Prevents the creator from withdrawing any funds", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("0.01") });
          await expect(
            project.connect(deployer).withdraw(ethers.utils.parseEther("0.01"))
          ).to.be.revertedWith(
            "Project cannot be withdrawn from at this time."
          );
        });

        it("Prevents contributors from withdrawing any funds", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("0.01") });
          await expect(
            project.connect(alice).withdraw(ethers.utils.parseEther("0.01"))
          ).to.be.revertedWith("Only the creator can call");
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("0.01") });
          await expect(
            project.connect(bob).withdraw(ethers.utils.parseEther("0.01"))
          ).to.be.revertedWith("Only the creator can call");
        });
      });

      describe("Project Status: Success", () => {
        it("Allows the creator to withdraw some of the contribution balance", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          const originalBalance = await deployer.getBalance();
          expect(
            await project
              .connect(deployer)
              .withdraw(ethers.utils.parseEther("1"))
          ).to.be.ok;
          const newBalance = await deployer.getBalance();
          expect(originalBalance.lt(newBalance)).to.equal(true);
        });

        it("Allows the creator to withdraw the entire contribution balance", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          expect(
            await project
              .connect(deployer)
              .withdraw(ethers.utils.parseEther("4"))
          );
        });

        it("Allows the creator to make multiple withdrawals", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          expect(
            await project
              .connect(deployer)
              .withdraw(ethers.utils.parseEther("1"))
          );
          expect(
            await project
              .connect(deployer)
              .withdraw(ethers.utils.parseEther("1"))
          );
          expect(
            await project
              .connect(deployer)
              .withdraw(ethers.utils.parseEther("1"))
          );
        });

        it("Prevents the creator from withdrawing more than the contribution balance", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          await expect(
            project.connect(deployer).withdraw(ethers.utils.parseEther("4.01"))
          ).to.be.revertedWith(
            "Amount to withdraw greater than funds available."
          );
        });

        it('Emits a "Withdraw" event after a withdrawal is made by the creator', async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          const txReceiptUnresolved = await project.withdraw(
            ethers.utils.parseEther("3")
          );
          const txReceipt = await txReceiptUnresolved.wait();
          expect(txReceipt.events![0].event).to.equal("Withdraw");
          expect(txReceipt.events![0].args![0]).to.equal(
            ethers.utils.parseEther("3")
          );
          expect(txReceipt.events![0].args![1]).to.equal(
            ethers.utils.parseEther("1")
          );
        });

        it("Prevents contributors from withdrawing any funds", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          await expect(
            project.connect(alice).withdraw(ethers.utils.parseEther("0.01"))
          ).to.be.revertedWith("Only the creator can call");
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther("4") });
          await expect(
            project.connect(bob).withdraw(ethers.utils.parseEther("0.01"))
          ).to.be.revertedWith("Only the creator can call");
        });
      });

      describe("Project Status: Failure", () => {
        it("Prevents the creator from withdrawing any funds (if not a contributor)", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther(".01") });
          timeTravel(SECONDS_IN_DAY * 30);
          await expect(
            project.withdraw(ethers.utils.parseEther(".01"))
          ).to.be.revertedWith(
            "Project cannot be withdrawn from at this time."
          );
        });

        it("Prevents contributors from withdrawing any funds (though they can still refund)", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther(".01") });
          timeTravel(SECONDS_IN_DAY * 30);
          await expect(
            project.connect(alice).withdraw(ethers.utils.parseEther(".01"))
          ).to.be.revertedWith("Only the creator can call");
          expect(await project.connect(alice).refund());
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          await project
            .connect(alice)
            .contribute({ value: ethers.utils.parseEther(".01") });
          timeTravel(SECONDS_IN_DAY * 30);
          await expect(
            project.connect(bob).withdraw(ethers.utils.parseEther(".01"))
          ).to.be.revertedWith("Only the creator can call");
        });
      });
    });

    describe("Refunds", () => {
      it("Allows contributors to be refunded when a project fails", async () => {
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".01") });
        timeTravel(SECONDS_IN_DAY * 30);
        const originalBalance = await alice.getBalance();
        expect(await project.connect(alice).refund());
        expect(originalBalance.lt(await alice.getBalance())).to.equal(true);
      });

      it("Prevents contributors from being refunded if a project has not failed", async () => {
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".01") });
        await expect(project.connect(alice).refund()).to.be.revertedWith(
          "Project not currently refundable."
        );
      });

      it('Emits a "Refund" event after a contributor receives a refund', async () => {
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".01") });
        timeTravel(SECONDS_IN_DAY * 30);
        const txReceiptUnresolved = await project.connect(alice).refund();
        const txReceipt = await txReceiptUnresolved.wait();
        expect(txReceipt.events![0].event).to.equal("Refund");
        expect(txReceipt.events![0].args![0]).to.equal(alice.address);
        expect(txReceipt.events![0].args![1]).to.equal(
          ethers.utils.parseEther(".01")
        );
      });
    });

    describe("Cancelations (creator-triggered project failures)", () => {
      it("Allows the creator to cancel the project if < 30 days since deployment has passed ", async () => {
        expect(await project.cancel());
      });

      it("Prevents the creator from canceling the project if at least 30 days have passed", async () => {
        timeTravel(SECONDS_IN_DAY * 30);
        await expect(project.cancel()).to.be.revertedWith(
          "Cannot cancel project that is not in an active state."
        );
      });

      it('Emits a "ProjectCancelled" event after a project is cancelled by the creator', async () => {
        const txReceiptUnresolved = await project.cancel();
        const txReceipt = await txReceiptUnresolved.wait();
        expect(txReceipt.events![0].event).to.equal("ProjectCancelled");
      });
    });

    describe("NFT Contributor Badges", () => {
      it("Awards a contributor with a badge when they make a single contribution of at least 1 ETH", async () => {
        expect(await project.balanceOf(alice.address)).to.equal(0);
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1") });
        expect(await project.balanceOf(alice.address)).to.equal(1);
      });

      it("Awards a contributor with a badge when they make multiple contributions to a single project that sum to at least 1 ETH", async () => {
        expect(await project.balanceOf(alice.address)).to.equal(0);
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".1") });
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".1") });
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".8") });
        expect(await project.balanceOf(alice.address)).to.equal(1);
      });

      it("Does not award a contributor with a badge if their total contribution to a single project sums to < 1 ETH", async () => {
        expect(await project.balanceOf(alice.address)).to.equal(0);
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".1") });
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".1") });
        expect(await project.balanceOf(alice.address)).to.equal(0);
      });

      it("Awards a contributor with a second badge when their total contribution to a single project sums to at least 2 ETH", async () => {
        // Note: One address can receive multiple badges for a single project,
        //       but they should only receive 1 badge per 1 ETH contributed.
        expect(await project.balanceOf(alice.address)).to.equal(0);
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".1") });
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("2") });
        expect(await project.balanceOf(alice.address)).to.equal(2);
      });

      it("Does not award a contributor with a second badge if their total contribution to a single project is > 1 ETH but < 2 ETH", async () => {
        expect(await project.balanceOf(alice.address)).to.equal(0);
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther(".1") });
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1") });
        expect(await project.balanceOf(alice.address)).to.equal(1);
      });

      it("Awards contributors with different NFTs for contributions to different projects", async () => {
        const txReceiptUnresolved2 = await projectFactory.create(
          ONE_ETHER,
          "Project1",
          "PR1"
        );
        const txReceipt2 = await txReceiptUnresolved2.wait();

        const projectAddress2: string = txReceipt2.events![1].args![0];
        const project2 = await ethers.getContractAt("Project", projectAddress2);

        expect(await project.balanceOf(alice.address)).to.equal(0);
        expect(await project2.balanceOf(alice.address)).to.equal(0);
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("2") });
        await project2
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("2") });
        expect(await project.balanceOf(alice.address)).to.equal(2);
        expect(await project2.balanceOf(alice.address)).to.equal(2);
      });

      it("Allows contributor badge holders to trade the NFT to another address", async () => {
        await project
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1") });
        await project
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            bob.address,
            0
          );
        expect(await project.balanceOf(alice.address)).to.equal(0);
        expect(await project.balanceOf(bob.address)).to.equal(1);
      });

      it("Allows contributor badge holders to trade the NFT to another address even after its related project fails", async () => {
        // Need to use new contract with higher goal amount
        // to let contributors get badge without completeing the project.
        const txReceiptUnresolved = await projectFactory.create(
          ethers.utils.parseEther("2"),
          "Project1",
          "PR1"
        );
        const txReceipt = await txReceiptUnresolved.wait();
        const projectAddress2: string = txReceipt.events![1].args![0];
        const project2 = await ethers.getContractAt("Project", projectAddress2);

        await project2
          .connect(alice)
          .contribute({ value: ethers.utils.parseEther("1") });

        timeTravel(SECONDS_IN_DAY * 31);

        // prove is failed
        expect(project2.connect(alice).refund()).to.be.ok;

        await project2
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            bob.address,
            0
          );
        expect(await project2.balanceOf(alice.address)).to.equal(0);
        expect(await project2.balanceOf(bob.address)).to.equal(1);
      });
    });
  });
});
