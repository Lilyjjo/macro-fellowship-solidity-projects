import { ethers } from "ethers";
import SpaceICOJson from "../../artifacts/contracts/SpaceICO.sol/SpaceICO.json";
import SpaceCoinJson from "../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const spaceICOAddr = "0x0492DC7e80dF0fC2Ee0B0975Ff817D0d56Fa76d7";
const icoContract = new ethers.Contract(
  spaceICOAddr,
  SpaceICOJson.abi,
  provider
);

const spaceCoinAddr = icoContract.spaceCoin();
const coinContract = new ethers.Contract(
  spaceCoinAddr,
  SpaceCoinJson.abi,
  provider
);

// For playing around with in the browser
window.ethers = ethers;
window.provider = provider;
window.signer = signer;
window.icoContract = icoContract;
window.coinContract = coinContract;

// Kick things off
go();

async function go() {
  await connectToMetamask();
  let address = await signer.getAddress();
  valueOutput.innerText = await signer.getAddress();
  spcAmount.innerText = await coinContract.balanceOf(address);
  stage.innerText = await icoContract.state();
  seedInvestor.innerText = await icoContract.allowList(address);
  spcClaimAmount.innerText = await icoContract.contributionBalances(address);
  paused.innerText = await icoContract.paused();
  transactionStatus.innerText = "Transaction info will appear here";

  pauseButton.addEventListener("click", async () => {
    console.log("pausing: ", pauseInput.value);
    transactionStatus.innerText = "Processing 'pause' transaction";
    icoContract
      .connect(signer)
      .setPaused(pauseInput.value !== "false" && pauseInput.value !== "0", {
        gasLimit: 100000,
      })
      .then((tx) => {
        return tx.wait().then(
          (receipt) => {
            transactionStatus.innerText =
              "No errors for last submitted 'pause' transaction!";
            return true;
          },
          (error) => {
            transactionStatus.innerText =
              "Error for last submitted 'pause' transaction! :(";
            console.log(error);
            return false;
          }
        );
      });
    paused.innerText = await (await icoContract.paused()).wait;
  });

  addSeedInvestorButton.addEventListener("click", async () => {
    transactionStatus.innerText = "Processing 'Add seed investor' transaction";
    console.log("addSeedInvestorButton: ", addSeedInvestor.value);
    icoContract
      .connect(signer)
      .addAllowlist(addSeedInvestor.value, { gasLimit: 100000 })
      .then((tx) => {
        return tx.wait().then(
          (receipt) => {
            transactionStatus.innerText =
              "No errors for last submitted 'Add seed investor' transaction!";
            return true;
          },
          (error) => {
            transactionStatus.innerText =
              "Error for last submitted 'Add seed investor' transaction! :(";
            console.log(error);
            return false;
          }
        );
      });
    seedInvestor.innerText = await (await allowList.paused(address)).wait;
  });

  contributeButton.addEventListener("click", async () => {
    console.log("contribute: ", contributeInput.value);
    transactionStatus.innerText = "Processing contribute transaction";

    icoContract
      .connect(signer)
      .contribute({ value: contributeInput.value, gasLimit: 100000 })
      .then((tx) => {
        return tx.wait().then(
          (receipt) => {
            transactionStatus.innerText =
              "No errors for last submitted contribute transaction!";
            return true;
          },
          (error) => {
            transactionStatus.innerText =
              "Error for last submitted contribute transaction! :(";
            console.log(error);
            return false;
          }
        );
      });
    spcAmount.innerText = await coinContract.balanceOf(address);
    spcClaimAmount.innerText = await icoContract.contributionBalances(address);
  });

  provider.on("block", async (n) => {
    console.log("New block", n);
    valueOutput.innerText = await signer.getAddress();
    spcAmount.innerText = await coinContract.balanceOf(address);
    spcClaimAmount.innerText = await icoContract.contributionBalances(address);
    paused.innerText = await icoContract.paused();
  });
}

async function connectToMetamask() {
  try {
    let address = await signer.getAddress();
    console.log("Signed in", address);
    return address;
  } catch (err) {
    console.log("Not signed in");
    await provider.send("eth_requestAccounts", []);
  }
}
