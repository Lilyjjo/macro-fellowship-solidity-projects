// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // deploy SpaceCoinLP
  /*
  const SpaceICO = await ethers.getContractFactory("SpaceICO");
  const spaceICO = await SpaceICO.deploy(
    "0x41dD638218bF3E97cc0b682165029E3eaA0ccEBd",
    "0x41dD638218bF3E97cc0b682165029E3eaA0ccEBd"
  );

  await spaceICO.deployed();
  console.log("SpaceICO deployed to:", spaceICO.address);

  // grab SpaceCoin address
  let spaceCoinAddress = await spaceICO.spaceCoin();
  console.log("SpaceCoin deployed to:", spaceCoinAddress);

  // deploy SpaceCoinLP
  const SpaceCoinLP = await ethers.getContractFactory("SpaceCoinLP");
  const spaceCoinLP = await SpaceCoinLP.deploy(
    spaceCoinAddress
  );
  await spaceCoinLP.deployed();
  console.log("SpaceCoinLP deployed to:", spaceCoinLP.address);

  // deploy SpaceCoinLPRouter
  const SpaceCoinLPRouter = await ethers.getContractFactory("SpaceCoinLPRouter");
  const spaceCoinLPRouter = await SpaceCoinLPRouter.deploy(
      spaceCoinLP.address,
      spaceCoinAddress
    );
  await spaceCoinLPRouter.deployed();
  console.log("SpaceCoinLPRouter deployed to:", spaceCoinLPRouter.address);
  */

  const SpaceICO_Addr = "0xb3A7d96174D337188B412Df71ab6aCc0DF9520C6";
  const SpaceCoin_Addr = "0xFD2B2C60619230C8fB06bB00ea257d0767186aA8";
  const SpaceCoinLP_Addr = "0x5655A22f8BC5d130cF636473DC0361D78EB73A50";
  const SpaceCoinLPRouterAddr = "0xe25116efc07A68EBFB5a35Fe859e440b70A38f64";

  const SpaceICO = await ethers.getContractFactory("SpaceICO");
  const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
  const SpaceCoinLP = await ethers.getContractFactory("SpaceCoinLP");
  const SpaceCoinLPRouter = await ethers.getContractFactory(
    "SpaceCoinLPRouter"
  );

  const spaceICO_contract = await SpaceICO.attach(SpaceICO_Addr);
  const spaceCoin_contract = await SpaceCoin.attach(SpaceCoin_Addr);
  const spaceCoinLP_contract = await SpaceCoinLP.attach(SpaceCoinLP_Addr);
  const spaceCoinLPRouter_contract = await SpaceCoinLPRouter.attach(
    SpaceCoinLPRouterAddr
  );

  // set ICO's phase to open
  //let tx = await spaceICO_contract.moveForward(2);
  //let rc = await tx;
  //console.log(rc);

  // check my spc balance
  //let tx = await spaceCoin_contract.balanceOf("0x41dD638218bF3E97cc0b682165029E3eaA0ccEBd");
  //console.log(tx);
  //let rc = await tx;
  //console.log(rc);

  // contribute 4 spc to pool
  /*
  let tx = await spaceCoin_contract.transfer(SpaceCoinLP_Addr, ethers.utils.parseEther("4"));
  console.log(tx);
  let rc = await tx;
  console.log(rc);
  */

  /*
  let [account, ] = await ethers.getSigners();
  
  // contribute ETH to pool
  const tx = await account.sendTransaction({
        to: SpaceCoinLP_Addr,
        value: ethers.utils.parseEther(".004"),
      });

  console.log(tx);
  let rc = await tx;
  console.log(rc); */

  // mint initial
  let tx = await spaceCoinLP_contract.mint(
    "0x41dD638218bF3E97cc0b682165029E3eaA0ccEBd"
  );
  console.log(tx);
  let rc = await tx;
  console.log(rc);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
