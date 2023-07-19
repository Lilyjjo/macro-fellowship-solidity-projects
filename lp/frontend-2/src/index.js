import { ethers } from "ethers";
import SpaceICOJSON from "../../artifacts/contracts/SpaceICO.sol/SpaceICO.json";
import SpaceCoinJSON from "../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json";
import SpaceCoinLPJSON from "../../artifacts/contracts/SpaceCoinLP.sol/SpaceCoinLP.json";
import SpaceCoinLPRouterJSON from "../../artifacts/contracts/SpaceCoinLPRouter.sol/SpaceCoinLPRouter.json";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const spaceCoinICOAddr = "0xb3A7d96174D337188B412Df71ab6aCc0DF9520C6";
const spaceCoinICO = new ethers.Contract(
  spaceCoinICOAddr,
  SpaceICOJSON.abi,
  provider
);
const spaceCoinAddr = "0xFD2B2C60619230C8fB06bB00ea257d0767186aA8";
const spaceCoin = new ethers.Contract(
  spaceCoinAddr,
  SpaceCoinJSON.abi,
  provider
);
const spaceCoinLPAddr = "0x5655A22f8BC5d130cF636473DC0361D78EB73A50";
const spaceCoinLP = new ethers.Contract(
  spaceCoinLPAddr,
  SpaceCoinLPJSON.abi,
  provider
);
const spaceCoinLPRouterAddr = "0xe25116efc07A68EBFB5a35Fe859e440b70A38f64";
const spaceCoinLPRouter = new ethers.Contract(
  spaceCoinLPRouterAddr,
  SpaceCoinLPRouterJSON.abi,
  provider
);

async function connectToMetamask() {
  try {
    console.log("Signed in as", await signer.getAddress());
  } catch (err) {
    console.log("Not signed in");
    await provider.send("eth_requestAccounts", []);
  }
}

//
// ICO
//
ico_spc_buy.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const eth = ethers.utils.parseEther(form.eth.value);
  console.log("Buying", eth, "eth");

  await connectToMetamask();
  // TODO: Call ico contract contribute function
  spaceCoinICO
    .connect(signer)
    .contribute({ value: eth, gasLimit: 100000 })
    .then((tx) => {
      return tx.wait().then(
        (receipt) => {
          console.log("No errors for last submitted contribute transaction!");
          return true;
        },
        (error) => {
          console.log("Error for last submitted contribute transaction! :(");
          console.log(error);
          return false;
        }
      );
    });
});

//
// LP
//
let currentSpcToEthPrice = 5;

provider.on("block", async (n) => {
  console.log("New block", n);
  let spcAmount = await spaceCoinLP.connect(signer).reserveSPC();
  let ethAmount = await spaceCoinLP.connect(signer).reserveETH();
  currentSpcToEthPrice = spcAmount.div(ethAmount).toNumber();
  console.log("currentSpcToEthPrice: ", currentSpcToEthPrice);
});

lp_deposit.eth.addEventListener("input", (e) => {
  lp_deposit.spc.value = +e.target.value * currentSpcToEthPrice;
});

lp_deposit.spc.addEventListener("input", (e) => {
  lp_deposit.eth.value = +e.target.value / currentSpcToEthPrice;
});

lp_deposit.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const eth = ethers.utils.parseEther(form.eth.value);
  const spc = ethers.utils.parseEther(form.spc.value);
  console.log("Depositing", eth, "eth and", spc, "spc");

  await connectToMetamask();
  // TODO: Call router contract deposit function
  await spaceCoin
    .connect(signer)
    .approve(spaceCoinLPRouterAddr, spc.mul(100).div(96));
  await spaceCoinLPRouter
    .connect(signer)
    .addLiquidity(spc, { value: eth, gasLimit: 1000000 })
    .then((tx) => {
      return tx.wait().then(
        (receipt) => {
          console.log("No errors for last submitted addLiquidity transaction!");
          return true;
        },
        (error) => {
          console.log("Error for last submitted addLiquidity transaction! :(");
          console.log(error);
          return false;
        }
      );
    });
});

lp_withdraw.addEventListener("submit", async (e) => {
  e.preventDefault();
  await connectToMetamask();
  console.log("Withdrawing 100% of LP");
  let maxLP = await spaceCoinLP.balanceOf(await signer.getAddress());
  await spaceCoinLP.connect(signer).approve(spaceCoinLPRouterAddr, maxLP);
  await spaceCoinLPRouter
    .connect(signer)
    .burnLiquidity(maxLP, { gasLimit: 1000000 })
    .then((tx) => {
      return tx.wait().then(
        (receipt) => {
          console.log(
            "No errors for last submitted burnLiquidity transaction!"
          );
          return true;
        },
        (error) => {
          console.log("Error for last submitted burnLiquidity transaction! :(");
          console.log(error);
          return false;
        }
      );
    });

  // TODO: Call router contract withdraw function
});

//
// Swap
//
let swapIn = { type: "eth", value: 0 };
let swapOut = { type: "spc", value: 0 };
switcher.addEventListener("click", () => {
  [swapIn, swapOut] = [swapOut, swapIn];
  swap_in_label.innerText = swapIn.type.toUpperCase();
  swap.amount_in.value = swapIn.value;
  updateSwapOutLabel();
});

swap.amount_in.addEventListener("input", updateSwapOutLabel);

function updateSwapOutLabel() {
  swapOut.value =
    swapIn.type === "eth"
      ? +swap.amount_in.value * currentSpcToEthPrice
      : +swap.amount_in.value / currentSpcToEthPrice;

  swap_out_label.innerText = `${swapOut.value} ${swapOut.type.toUpperCase()}`;
}

swap.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  console.log(swapOut.value);
  const amountIn = ethers.utils.parseEther(form.amount_in.value);
  const amountOut = ethers.utils.parseEther(swapOut.value.toFixed(18));

  console.log("Swapping", amountIn, swapIn.type, "for", swapOut.type);

  await connectToMetamask();
  // TODO: Call router contract swap function
  if (swapIn.type == "eth") {
    console.log("buying spc");
    await spaceCoinLPRouter
      .connect(signer)
      .swap(0, amountOut, amountIn.mul(2), {
        value: amountIn.mul(2),
        gasLimit: 1000000,
      })
      .then((tx) => {
        return tx.wait().then(
          (receipt) => {
            console.log("No errors for last submitted swap transaction!");
            return true;
          },
          (error) => {
            console.log("Error for last submitted swap transaction! :(");
            console.log(error);
            return false;
          }
        );
      });
  } else {
    console.log("buying eth");
    console.log("amountOut:", amountOut.toString());
    console.log("amountIn:", amountIn.mul(2).toString());
    console.log("value:", amountIn.mul(2).toString());
    await spaceCoin
      .connect(signer)
      .approve(spaceCoinLPRouterAddr, amountIn.mul(2));
    await spaceCoinLPRouter
      .connect(signer)
      .swap(amountOut, 0, amountIn.mul(2), { gasLimit: 1000000 })
      .then((tx) => {
        return tx.wait().then(
          (receipt) => {
            console.log("No errors for last submitted swap transaction!");
            return true;
          },
          (error) => {
            console.log("Error for last submitted swap transaction! :(");
            console.log(error);
            return false;
          }
        );
      });
  }
});
