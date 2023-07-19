* Peer Micro Audit for Lilyjo

= General comments

- Great work Lily! I liked how you had kept the code so clean and simple with comments. It was easy to read understand. I also appreciated the thought you
put into doing the bulk functionality with revert or not to revert. The expiration period for the execution is also a nice consideration considering without it, proposal execution may be quite random and make it harder for members to understand the projected treasury state.

** H-1:

** M-1: Line 273 there is a rounding error for computing quorum:

   ``` uint256 quorum = memberCount / PROPOSAL_QUORUM_DENOMINATOR;```

I made this mistake too! if memberCount is 7, then 7/4 = 1.75 which rounds to 1, but can instead keep track of the memberCount (7) at time of
proposal creation, then in the quorum check, do `if yesCount * 4 >= quorumRequirement`

** L-1:

** Q-1: Shorter revert messages. On line 263, 306, 452 ..

I learned about this in my last staff audit! A best practice is to use short messages and leave it to the off-chain to elaborate on the description. I believe this also has some savings: https://medium.com/@chebyk.in/how-big-is-solidity-custom-error-messages-overhead-1e915724b450

** Q-2: On line 361:

        (bool success, bytes memory result) = payable(nftMarketplace).call{
            value: price
        }(
            abi.encodeWithSignature(
                "buy(address,uint256)",
                nftContract,
                tokenID
            )
        );

Can consider using `_nftMarketplace.buy(address, uint256)` call directly since you have the contract instance available already.

** Q-3: On line 453 and Redundant Invalid ProposalID check, consider removing. Since `proposalStatus(id)` has:

        ```require(proposals[proposalID].id != 0, "Not a valid proposal");```
that takes care of the valid proposal check!


** Q-4: Minor optimization on line 474 and 477:
    ```   proposal.voteYes++;```

Consider doing `++proposal.voteYes` so the compiler doesn't need to store a temporary variable to return the not-yet-incremented number.



