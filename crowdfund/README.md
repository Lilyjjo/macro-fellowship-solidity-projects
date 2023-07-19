## Design question:

Smart contracts have a hard limit of 24kb. Crowdfundr hands out an NFT to everyone who contributes. However, consider how Kickstarter has multiple contribution tiers. How would you design your contract to support this, without creating three separate NFT contracts?

# Answer:

I would add a mapping per NFT to tier, `mapping(uint256 => uint256) _tokenTier`. I'd change the minting functions (`_safeMint` variations and `_mint`) to set the token's tier when minting. I'd also add a function `getTokenTier()` to aid in seeing what a token's tier is. This would add the ability to have tokens of different tiers without having to have mutliple contracts.

# Non-Technical Client Exercise History:

## More Answered Questions for Client:

1. Who is allowed to withdraw the funds of a met goal? Just the owner?
   1. reply: Yes only the owner can withdraw from a successful project
2. Are NFTs distributed to people based on their (1) total contribution to a single project, (2) contributions done in a single transaction, (3) all contributions across all projects, or (4) a different metric?
   1. reply: an address receives a badge if their total contributions to a single project is at least 1 ETH.
      1. One address can receive multiple NFT badges, but should only receive 1 badge per 1 ETH
3. Why do you want the NFTs to be tradable?
   1. reply: NFT should follow the ERC721 protocol. These are tradable
4. Are there any restrictions on who can contribute? As in, can anyone or do contributors have to be designated in some fashion?
   1. reply: Anyone can contribute including the owner.

## Answered Questions from the Client

1. Is there any data that needs to be associated with projects that clients register? Is assigning an id to the project sufficient?
   1. reply: just the owner and the goal amt is necessary
2. What happens if the ‘goal’ is not met?

   a: reply: if the goal is not met, then the project is considered to have failed.

   - No one can contribute anymore
   - Supporters get their money back
   - Contributors badges are left alone. They should still be trade-able

3. Is there a time limit, or some other limit, to getting the ‘goal’ met?
   1. reply: the owner has 30 days to reach the goal
4. Can the creator change the ‘goal’ amount post-setup?
   1. The goal cannot be changed after a project gets created
5. Can contributors continue to add funds to the project once the goal is met?
   1. Once the goal is met, no one else can contribute(however, the last contribution can go over the goal)
6. Can contributors who give more than 1 ETH also get the badge?
   1. One address can receive multiple badges, but should only receive 1 badge per 1 ETH contributed
7. Do contributors who give 2 ETH get two badges?
   1. reply: yes
8. Is there a min or a max contribution ETH limit per contributor?
   1. reply: the contribute amount must be at least 0.01 ETH. There is no upper limit
9. Can the same contributor contribute to the same project multiple times?
   1. reply: One address can contribute as many times as they like.
