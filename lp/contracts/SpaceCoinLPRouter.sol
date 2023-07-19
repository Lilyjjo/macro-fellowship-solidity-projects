//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./SpaceCoinLP.sol";
import "./SpaceCoin.sol";

/**
 * @title A Liquidity Pool Router for 'SpaceCoinLP'
 * @author Lily Johnson
 * @notice This contract provides non-security critical helper wrapper logic
 * for SpaceCoin's liquidity pool SpaceCoinLP. Note: `msg.sender` will have
 * to approve this contract to transfer SpaceCoin and SpaceCoinLP tokens for
 * the logic to work. If the user transfers SPC/SPCLP to the SpaceCoinLP
 * pool independently, the user risks making suboptimial interactions.
 */
contract SpaceCoinLPRouter {
    SpaceCoinLP public immutable spaceCoinLP;
    SpaceCoin public immutable spaceCoin;

    constructor(address payable spaceCoinLP_, address spaceCoin_) {
        spaceCoinLP = SpaceCoinLP(spaceCoinLP_);
        spaceCoin = SpaceCoin(spaceCoin_);
    }

    /**
     * @notice Calculates how much asset B should be paired with asset
     * A in order to get max returns for liquidity minting. SpaceCoinLP's
     * minting function will use the smaller asset's liquidity shift impact
     * to calcuate rewards in order to incentivize keeping the asset ratios
     * balanced. So, this function will return the minimal amount of B,
     * given A, which will keep the pool balances with maximal liquidity to the
     * caller.
     * @param inputA amount of asset A to be deposited
     * @param reserveA the balance of A's reserves in the pool
     * @param reserveB the balance of B's reserves in the pool
     * @param totalLiquidity the total liquidity currently in the pool
     * @param spcTaxOn if spc's tax is turned on
     * @param inputAisSPC if inputA is SPC, needed for tax calculation
     * @return inputB the amount of B to maximize liquidity returns
     */
    function matchLiquidity(
        uint256 inputA,
        uint256 reserveA,
        uint256 reserveB,
        uint256 totalLiquidity,
        bool spcTaxOn,
        bool inputAisSPC
    ) public pure returns (uint256 inputB) {
        if (!spcTaxOn) {
            uint256 liquidityA = (inputA * totalLiquidity) / reserveA;
            inputB = (reserveB * liquidityA) / totalLiquidity;
        } else {
            if (inputAisSPC) {
                // spc is taxed going in to a smaller amount
                uint256 liquidityA = (((inputA * 98) / 100) * totalLiquidity) /
                    reserveA;
                inputB = (reserveB * liquidityA) / totalLiquidity;
            } else {
                // inflate spc to equal eth amount
                uint256 liquidityA = ((inputA) * totalLiquidity) / reserveA;
                inputB = ((((reserveB * liquidityA) / totalLiquidity) * 100) /
                    98);
            }
        }
    }

    /**
     * @notice Adds liquidity to SpaceCoinLP's pool, minting LP tokens to the
     * `msg.sender`. NOTE: this function will use either `desiredSPCAmount` to
     * calculate the needed ETH amount, or if `desiredSPCAmount` is zero, this
     * function will use the `msg.value` input to calculate the needed SPC amount.
     * See `matchLiquidity()` for calculation details.
     * @param desiredSPCAmount desired amount of SPC to use for minting. If zero, the `msg.value` amount will be used.
     */
    function addLiquidity(uint256 desiredSPCAmount) external payable {
        uint256 ethAmount;
        uint256 spcAmount;
        uint256 reserveETH = spaceCoinLP.reserveETH();
        uint256 reserveSPC = spaceCoinLP.reserveSPC();
        uint256 totalLiquidity = spaceCoinLP.totalLiquidity();
        bool spcTaxOn = spaceCoin.tax();

        if (totalLiquidity == 0) {
            // first time adding liquidity
            ethAmount = msg.value;
            spcAmount = desiredSPCAmount;
        } else if (desiredSPCAmount == 0) {
            // ETH input used to determine SPC input
            ethAmount = msg.value;
            spcAmount = matchLiquidity(
                msg.value,
                reserveETH,
                reserveSPC,
                totalLiquidity,
                spcTaxOn,
                false
            );
        } else {
            // SPC input used to determine ETH input
            spcAmount = desiredSPCAmount;
            ethAmount = matchLiquidity(
                desiredSPCAmount,
                reserveSPC,
                reserveETH,
                totalLiquidity,
                spcTaxOn,
                true
            );
        }

        // transfer balances
        spaceCoin.transferFrom(msg.sender, address(spaceCoinLP), spcAmount);
        (bool success, ) = address(spaceCoinLP).call{value: ethAmount}("");
        require(success, "ETH transfer failed");

        // mint
        spaceCoinLP.mint(msg.sender);

        // return extra ETH
        if (msg.value > ethAmount) {
            (success, ) = payable(msg.sender).call{
                value: (msg.value - ethAmount)
            }("");
            require(success, "ETH return failed");
        }
    }

    /**
     * @notice Burns amount of liquidity, sending the asset tokens to the
     * `msg.sender`.
     * @param liquidityAmount amount of liquidity to be burnt
     */
    function burnLiquidity(uint256 liquidityAmount) external {
        spaceCoinLP.transferFrom(
            msg.sender,
            address(spaceCoinLP),
            liquidityAmount
        );
        spaceCoinLP.burn(msg.sender);
    }

    /**
     * @notice Calculates the minimal amount of asset B which is needed to be sent
     * to SpaceCoinLP's swap to get A tokens out while preserving K. A tax is
     * applied to asset B. Forumla taken from Uniswap's V2 Routerv2
     * @param desiredA how much of asset A is a desired output
     * @param reserveA current reserve balanace for A in SpaceCoinLP's pool
     * @param reserveB current reserve balanace for B in SpaceCoinLP's pool
     * @return requiredB how much asset B to send to preserve K for desired A
     */
    function swapAmount(
        uint256 desiredA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure returns (uint256 requiredB) {
        requiredB =
            ((reserveB * desiredA * 100) / ((reserveA - desiredA) * 99)) +
            1;
    }

    /**
     * @notice Swaps either `desiredOutputETH` or `desiredOutputSPC` for the
     * other asset.
     * @param desiredOutputETH amount of ETH desired at end of swap
     * @param desiredOutputSPC amount of SPC desired at end of swap
     * @param maxAmountIn max amount of non-specified token user is willing
     * to pay in order to receive specified desired amount
     */
    function swap(
        uint256 desiredOutputETH,
        uint256 desiredOutputSPC,
        uint256 maxAmountIn
    ) external payable {
        require(
            (desiredOutputETH == 0 || desiredOutputSPC == 0) &&
                desiredOutputETH != desiredOutputSPC,
            "Only one non-zero output supported"
        );
        uint256 reserveETH = spaceCoinLP.reserveETH();
        uint256 reserveSPC = spaceCoinLP.reserveSPC();
        bool spcTaxOn = spaceCoin.tax();

        if (desiredOutputETH != 0) {
            require(desiredOutputETH < reserveETH, "Not enough LP ETH");
            uint256 neededInputSPC = swapAmount(
                desiredOutputETH,
                reserveETH,
                reserveSPC
            );
            if (spcTaxOn) {
                neededInputSPC = ((neededInputSPC * 100) / 98);
            }
            require(neededInputSPC <= maxAmountIn, "Price past limit");
            spaceCoin.transferFrom(
                msg.sender,
                address(spaceCoinLP),
                neededInputSPC
            );
            spaceCoinLP.swap(msg.sender, 0, desiredOutputETH);
        } else {
            if (spcTaxOn) {
                desiredOutputSPC = ((desiredOutputSPC * 100) / 98);
            }
            uint256 neededInputETH = swapAmount(
                desiredOutputSPC,
                reserveSPC,
                reserveETH
            );
            require(desiredOutputSPC < reserveSPC, "Not enough LP SPC");
            require(neededInputETH < msg.value, "Not enough ETH sent in");
            require(neededInputETH <= maxAmountIn, "Price past limit");

            (bool success, ) = address(spaceCoinLP).call{value: neededInputETH}(
                ""
            );
            require(success, "ETH swap transfer failed");
            spaceCoinLP.swap(msg.sender, desiredOutputSPC, 0);

            if (neededInputETH < msg.value) {
                // return extra ETH if any
                (success, ) = address(msg.sender).call{
                    value: msg.value - neededInputETH
                }("");
                require(success, "ETH return transfer failed");
            }
        }
    }
}
