//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/*
interface NftMarketplace {
    function getPrice(address nftContract, uint nftId) external returns (uint price);
    function buy(address nftContract, uint nftId) external payable returns (bool success);
}
*/

contract ToyNFTMarketPlace is ERC721 {
    uint256 public nextTokenId;
    uint256 public nextTokenPrice;
    uint256 public bumpCalled;

    constructor() ERC721("ToyNFTMarketPlace", "TNM") {
        nextTokenPrice = 1 ether;
    }

    function bumpCall() external {
        bumpCalled++;
    }

    function getPrice(address, uint256) external view returns (uint256 price) {
        // pretend like we check nftContract addy (bloop!)
        // pretend like we use nftId addy (bloop !)
        return nextTokenPrice;
    }

    function buy(address, uint256 tokenID)
        external
        payable
        returns (bool success)
    {
        require(msg.value == nextTokenPrice);
        // pretend like we check nftContract addy (bloop!)
        // pretend like we use nftId addy (bloop !)
        _safeMint(msg.sender, nextTokenId++);
        nextTokenPrice += 0.1 ether;
        if (tokenID == 42) {
            return false;
        }
        require(tokenID != 24);
        return true;
    }
}
