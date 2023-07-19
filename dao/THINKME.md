System needs:

- a treasury contract that buys NFTs (interface below)
- a voting system
  - signature votes
  - buy membership for 1 ETH
  - allow members to propose a NFT to buy
  - 25% quorum, voted on by members
  - If passed, have the NFT be purchased
  - a function that allows any address to tally a vote cast by a DAO member using offchain-generated signatures
  - a function to do this in bulk too
- a proposal system that calls arbitrary functions
- ERC721.safeTransferFrom() function

Proposal System:

- 1 week voting period
- 1 week exectution period
- voting via signature (user signs off chain, 'we' run it on-chain)
- 25% quorum
- per-contract nonce for replay attack
- expiry to check for outdated signatures
- fee for sumbitting proposal (to reduce spam attacks)
- no limit on # of current proposals
- can change vote if you want to

DAO Membership:

- 1 ETH for membership
- interface NftMarketplace {
  function getPrice(address nftContract, uint nftId) external returns (uint price);
  function buy(address nftContract, uint nftId) external payable returns (bool success);
  }
