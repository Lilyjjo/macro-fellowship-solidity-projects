# CollectorDAO Documentation

CollectorDAO is a DAO created with the goal of purchasing NFTs. Members of the DAO are able to submit and vote on generic proposals. There is a streamlined function for submitting proposals to buy NFTs. More details are below. This is a simple, MVP DAO implementation.

## Membership

Membership into the DAO is simple: anyone can join for the price of 1 ETH. An address is only able to buy a single membership.

## Voting

Voting is also simple. One member receives one vote. Members can only vote 'yes' or 'no'. A member is only able to vote once per proposal. There are multiple functions to vote by:

- `votOnChain()`: A member can submit their own vote.
- `voteOffChain()`: Another party can submit a vote which was signed by a member.
- `voteOffChainBulk()`: Another party can submit a collection of votes to tally of members. All votes are ran even if some are unsuccessful. Return values are found in events and in a returned boolean array.

This voting system is very basic. It conforms with the idea that one address can only pay 1 ETH for membership. If addresses were able to pay a variable amount, it would have made sense to have a different voting system with different weights, such as quadratic voting. This system is vulnerable to whales buying multiple memberships and having the ability to sway the system.

## Proposals

The proposal system is as follows:

- It costs .001 ETH to submit a proposal. This is in order to protect the DAO from spam proposals.
- The proposal voting period is 8 days. This is in order to allow people to have a weekly voting cadence.
- A 25% quorum of all members is necessary for a proposal to be either `EXECUTION` or `FAILED`, depending on the outcome. If the quorum is not reached in 8 days, the proposal enters a `QUORUM_NOT_MET` state.
- If the DAO has less than 4 members, quorum is always at least 1 member.
- After 8 days, if a proposal gathered enough votes to reach quorum and the outcome was acceptance, the proposal enters into an `EXECUTION` phase where anyone can submit the proposal to run using the `execute()` function. If the proposal runs successfully, it is enters the state `EXECUTED`.
- Proposals which fail during execution are able to be tried again until successful or until 16 days have passed.
- If a `EXECUTION` stated proposal is not executed by 16 days past the proposal's creation, it becomes `EXPIRED`.
- No actions are takable on proposals in the following stages: `FAILED`, `QUORUM_NOT_MET`, `EXECUTED`, or `EXPIRED`.
- The only funds that are available to the proposals are those which are gained via membership fees and proposal fees. The contract could be force fed ETH which could also be used during proposals. 

This proposal system doesn't allow for threading of return values between proposal items. It also doesn't allow for proposals to be cancelled, they can only expire. It also requires that all proposal items pass for the proposal to succeed.

The proposal system also stores all information on chain. This is expensive, but, it is more simple and allows members to more easily see what is in a proposal.

## Streamlined NFT Purchasing

NFTs purchasing proposals can be submitted by members for also .001ETH using the `nftProposal()` function. This function creates a proposal that will attempt to buy an NFT from a specified NFTMarketplace which conforms to the interface below. The proposal will fail if the NFT's price is greater than the max price or if the NFT is no longer on the market.

NFTMarketplace interface:
```
interface NftMarketplace {
    function getPrice(address nftContract, uint256 nftId)
        external
        returns (uint256 price);

    function buy(address nftContract, uint256 nftId)
        external
        payable
        returns (bool success);
}
```



# Design Exercises 

Prompt: *Per project specs there is no vote delegation; it's not possible for Alice to delegate her voting power to Bob, so that when Bob votes he does so with the voting power of both himself and Alice in a single transaction. This means for someone's vote to count, that person must sign and broadcast their own transaction every time. How would you design your contract to allow for non-transitive vote delegation?*

I'd add additional voting logic to accomodate vote delegation. I'd add mappings to track who has delegated to whom and how much voting power an address has. New members would start out with their delegatee being themselves. Members would be able to change their delegation via a function.

See psuedo code below with a partial implementation.

```
mapping(address => uint256) public votingPowers;
mapping(address => address) public voteDelegations;

function delegateVotes(address delegatee){
	require(voteDelegations[msg.sender] != delegatee, "Delegatee already has power");

	votingPowers[voteDelegations[msg.sender]]--;
	votingPowers[delegatee]++;
	voteDelegations[msg.sender] = delegatee;
}

function votingFunction(...) {
	/* will use votingPowers[voter] to vote instead of 1:1 voting */
}
```



Prompt: *What are some problems with implementing transitive vote delegation on-chain? (Transitive means: If A delegates to B, and B delegates to C, then C gains voting power from both A and B, while B has no voting power).*

Transitive on-chain vote delegation could run into some issues with how expensive the accounting logic would be to maintain the system.

There exists different options on how to maintain this on-chain. You could do like above and map who has given power to who, and then during runtime the transverse the whole structure to determine someone's power. This could be very expensive in terms of gas if there are many members.

There exists the option to keep the state of someone's power in storage so you don't have to compute during voting. But, let's say you have a long chaing of vote delegation: A -> B -> C -> D -> E. Let's say that A decides to change their vote delegation to F. You'd have to go update the storage slots of A/B/C/D/E and F. In longer chains, this updating of storage could also become very costly.

Top of mind implementations for transitive vote delegation on-chain sound too expensive computation wise for the EVM to reasonably run.
