## **Index**

-   [**Index**](#index)
-   [**ICO Audit Report**](#ico-audit-report)
-   [**Static Analysis**](#static-analysis)
-   [**[L-1]** Skipping a phase is permitted](#l-1-skipping-a-phase-is-permitted)

## **ICO Audit Report**

These contracts aims to create ICO for SpaceCoin that aims to raise 30,000 of ETH in total. There are 3 phases (SEED, GENERAL and OPEN). SEED phase only allows whitelisted addresses to deposit with max individual contribution capped at 1,500 ETH and total phase contribution capped at 15,000 ETH. GENERAL phase allows anyone to contribute with a max individual cap of 1,000 ETH (including the whitelisted address contribution from SEED phase). OPEN phase removes the individual contribution cap however the total amount to raise cap still exists. At any point in time the owner can pause the fundraise resulting in no contribution allowed and can also forward phase (SEED -> GENERAL -> OPEN).

This micro audit was conducted by Harpalsinh Jadeja student of block 6 of the Macro Solidity bootcamp.

## **Static Analysis**

The execution of static analysis _slither_ identified 22 potential issues within the codebase.

-   14 were related to openzeppelin contracts related to allowing older version so ruled out.
-   2 are related to allowing older version in SpaceCoin.sol and SpaceICO.sol, specifying the latest version is suggested.
-   3 related to zero-address check where are false-positive since solidity implicitly checks it.
-   1 related to locking ether which is because the spec never mentioned to implement a `withdraw` function (which is fine).

`SpaceICO.contribute() (contracts/SpaceICO.sol#108-156) ignores return value by spaceCoin.transfer(msg.sender,msg.value * 5) (contracts/SpaceICO.sol#152)`

` SpaceICO.redeemSpaceCoin() (contracts/SpaceICO.sol#161-171) ignores return value by spaceCoin.transfer(msg.sender,contributionBalance * 5) (contracts/SpaceICO.sol#170)`

-   2 related to ignoring return value of transfers (which is ok in this case since the token contract is also implemented by yourselves, though a good practice is use the return to confirm that the transfer was indeed successful).

## **[L-1]** Skipping a phase is permitted.

On line 66, SpaceICO.sol has the following code:

```
function moveForward(States newState) external onlyOwner {
    require(
        uint256(newState) != uint256(state),
        "ICO already at that state"
    );
    require(
        uint256(newState) <= uint256(States.OPEN),
        "Invalid state size"
    );
    require(
        uint256(state) < uint256(newState),
        "Can't set state backwards"
    );
    state = newState;
    emit NewState(state);
}
```

This code allows the owner to skip the phase. For example:- The owner can go from SEED to OPEN skipping GENERAL.

The spec says
"The owner of the contract should have the ability to pause and resume fundraising at any time, as well as move _**a phase forwards**_ (but not backwards) at will."

Consider: Taking the current state and only incrementing by one, or in your case subtract and the difference should be one, newState should be greater than current and also less than equal to 2.
