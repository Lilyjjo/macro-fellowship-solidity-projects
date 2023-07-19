## Testnet Contract link

https://goerli.etherscan.io/address/0x0492DC7e80dF0fC2Ee0B0975Ff817D0d56Fa76d7

## Design Questions

Question: The base requirements give contributors their SPC tokens immediately. How would you design your contract to vest the awarded tokens instead, i.e. award tokens to users over time, linearly?

Answer:

I'd start to track each contribution as its own time-vesting entity. Contributors would
receive a contributionID per contribution that they could claim SPC from as time passes.

I'd add a new struct to keep track of a contribution's data, and I would add two new
mappings: one relating the contributionID to its struct, and, one relating an address
to the contributionIDs that it owns.

The contribution struct would contain all information needed to know how much SPC is
available to be withdrawn for the contribution. An example of how this could be done
is shown below in pseudo code.

```
Struct Contribution {
	uint256 id;
	address owner;
	uint256 timeStart;
	uint256 timeEnd;
	uint256 totalSPC;
	uint256 claimedSPC;
}

mapping(uint256 => Contribution) public contributions; // mapping of contributionIDs to Contribution
mapping(address => uint256[]) public contributionIDMap; // mapping of address to their contributionIDs

// function to return all available funds for a contribution
claim(uint256 contributionID) external {
	Contribution storage contribution = contributions(contributionID);
	require(contribution.owner == msg.sender, "Not owner of contribution");

	uint256 amountAvailable;
	if(block.timestamp >= contribution.timeEnd) {
		amountAvailable = contribution.totalSPC - contribution.claimedSPC;
		contribution.claimedSPC = contribution.totalSPC;
	} else {
		uint256 timeWhole = (contribution.timeEnd - contribution.timeStart);
		uint256 timePassed = (block.timestamp - contribution.timeStart);
		uint256 amountAvailableTimewise = (totalSPC * timePassed) / timeWhole;
		amountAvailable = amountAvailableTimewise - claimedSPC;
		contribution.claimedSPC += amountAvailable;
	}
 
 	/* update other contract state needed */

	spaceCoin.transfer(amountAvailable); // imagine this to be the way that the ICO
										 // transfers SPC tokens
}
```
