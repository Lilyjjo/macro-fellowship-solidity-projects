//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./SpaceCoin.sol";

/**
 * @title A Liquidity Pool exchanging ETH for SPC
 * @author Lily Johnson
 * @notice This contract provides the security critical helper logic
 * for SpaceCoin's liquidity pool SpaceCoinLP.
 */
contract SpaceCoinLP is ERC20 {
    // SpaceCoin contract
    SpaceCoin public immutable spaceCoin;

    // Total amount of SPC in reserves contributing to liquidity
    uint256 public reserveSPC;
    // Total amount of ETH in reserves contributing to liquidity
    uint256 public reserveETH;
    // Total amount of liquidity in circulation
    uint256 public totalLiquidity;

    // Percent left after tax is applied
    uint256 public constant POST_TAX_AMOUNT = 99;
    // Amount of initial LP burned for pool safety
    uint256 public constant MIN_LIQUIDITY = 1000;
    // Is set to SpaceCoin's address, which has no functionality to send
    // funds elsewhere
    address public constant BURN_ADDRESS = address(1);

    // reentrancy lock
    bool public lock;

    event Burn(
        address indexed receiver,
        uint256 liquidity,
        uint256 ethOut,
        uint256 spcOut
    );
    event Mint(
        address indexed receiver,
        uint256 liquidity,
        uint256 ethIn,
        uint256 spcIn
    );
    event Swap(
        address indexed receiver,
        uint256 ethIn,
        uint256 ethout,
        uint256 spcIn,
        uint256 spcOut
    );

    modifier reentrancy_lock() {
        require(!lock, "Locked");
        lock = true;
        _;
        lock = false;
    }

    constructor(address spaceCoin_) ERC20("SpcEthLP", "SPCLP") {
        spaceCoin = SpaceCoin(spaceCoin_);
    }

    receive() external payable {}

    /**
     * @notice Burns sent in LP tokens and sends funds to address `to`. Note:
     * if SpaceCoin's tax is turned on, less SPC will be transfered as a result.
     *
     * @param to address to send SPC/ETH to
     */
    function burn(address to) external reentrancy_lock {
        uint256 liquidity = balanceOf(address(this));
        uint256 ethToSend = (liquidity * address(this).balance) /
            totalLiquidity;
        uint256 spcToSend = (liquidity * spaceCoin.balanceOf(address(this))) /
            totalLiquidity;
        require(
            ethToSend > 0 && spcToSend > 0,
            "Insufficient liquidity burned"
        );
        _burn(address(this), liquidity);
        totalLiquidity -= liquidity;

        spaceCoin.transfer(to, spcToSend);

        reserveETH = address(this).balance - ethToSend;
        reserveSPC = spaceCoin.balanceOf(address(this));

        (bool success, ) = payable(to).call{value: ethToSend}("");
        require(success, "Failed to transfer ETH");
        emit Burn(to, liquidity, ethToSend, spcToSend);
    }

    /**
     * @notice Mints liquidity to `to` based on amounts send to
     * this contract since the last interaction.
     *
     * @param to the address to send the liquitidy to
     */
    function mint(address to) external reentrancy_lock {
        uint256 spcChange = spaceCoin.balanceOf(address(this)) - reserveSPC;
        uint256 ethChange = address(this).balance - reserveETH;
        require(spcChange != 0 && ethChange != 0, "Nothing to mint");

        uint256 liquidity;
        if (totalLiquidity == 0) {
            // initial deposit, use geometric mean to determine initial liquidity supply
            totalLiquidity = sqrt(spcChange * ethChange);
            liquidity = totalLiquidity - MIN_LIQUIDITY;
            _mint(BURN_ADDRESS, MIN_LIQUIDITY);
        } else {
            // use smaller amount to incentivize keeping pool balanced
            uint256 spcLiquidity = (spcChange * totalLiquidity) / reserveSPC;
            uint256 ethLiquidity = (ethChange * totalLiquidity) / reserveETH;
            liquidity = spcLiquidity < ethLiquidity
                ? spcLiquidity
                : ethLiquidity;
            require(liquidity > 0, "Min liquidity is zero");
            totalLiquidity += liquidity;
        }
        _mint(to, liquidity);

        reserveSPC = spaceCoin.balanceOf(address(this));
        reserveETH = address(this).balance;

        emit Mint(to, liquidity, ethChange, spcChange);
    }

    /**
     * @notice Swaps either spc for eth or eth for spc.
     *
     * @param to address to send the tokens to
     * @param spcOut how much SPC is desired out
     * @param ethOut how much ETH is desired out
     */
    function swap(
        address to,
        uint256 spcOut,
        uint256 ethOut
    ) external reentrancy_lock {
        // figure out if person sent in correct amount
        require(spcOut != 0 || ethOut != 0, "Zero out amounts");
        uint256 spcIn = spaceCoin.balanceOf(address(this)) - reserveSPC;
        uint256 ethIn = address(this).balance - reserveETH;

        // check K
        uint256 kStart = (reserveSPC * 100) * (reserveETH * 100);
        uint256 kNew = ((reserveSPC * 100) +
            (spcIn * POST_TAX_AMOUNT) -
            (spcOut * 100)) *
            ((reserveETH * 100) + (ethIn * POST_TAX_AMOUNT) - (ethOut * 100)); //enforces that enough was deposited

        require(kStart <= kNew, "Insufficient K");

        // update balances
        reserveETH = reserveETH + ethIn - ethOut;
        reserveSPC = reserveSPC + spcIn - spcOut;

        // transfer tokens
        if (spcOut != 0) spaceCoin.transfer(to, spcOut);
        if (ethOut != 0) {
            (bool success, ) = payable(to).call{value: ethOut}("");
            require(success, "ETH transfer failed");
        }

        emit Swap(to, ethIn, ethOut, spcIn, spcOut);
    }

    // taken from https://github.dev/Uniswap/v2-core/blob/master/contracts/UniswapV2ERC20.sol
    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
