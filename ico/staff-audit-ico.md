https://github.com/0xMacro/student.Lilyjjo/tree/550140a70bab16014bc085c6532c562df72d7aff/ico

Audited By: Diana

# General Comments

1. Great work! Nice job using checks-effects-interactions throughout your contracts and good use of immutables.
2. Whenever you have repeated lines of code, think how you can condense it. Code on the blockchain is gas consuming - the less lines the better!
 
# Design Exercise

Good idea giving each contribution its own time-vesting entity and storing each contribtion in a struct. Love how you incldued the code to back up your answer!

# Issues

**[L-1]** Dangerous Phase Transitions

In the `moveForward` function, a phase can be skipped. As an example, if the current phase is SEED, the owner can jump to the OPEN phase skipping the GENERAL phase.

Consider refactoring this function by using an input parameter that specifies the expected current phase instead, or ensuring that the `newState` input parameter is just 1 phase ahead of the current phase.


**[Q-1]** Transfer overrides could be combined

Rather than individually overriding the OZ `transfer` and `transferFrom` functions to collect tax, you could just override `_transfer` which they both call.


**[Q-2]** Needless setting of storage variable's initial values

Line 57 SpaceICO.sol `paused = false;` is not needed (and wastes gas) because the default is false. Every variable type has a default value it gets set to upon declaration. 

For example:
```
address a;  // will be initialized to the 0 address (address(0))
uint256b;  // will be initialized to 0
bool c;     // will be initialized to false
```
Consider not setting initial values for storage variables that would
otherwise be equal to their default values.


**[Q-3]** Unnecessary require statement

In the `moveForward` function, the transaction will revert right away if a phase higher than 2 is passed as a parameter (since there are no phases higher than 2). Therefore, this is an unnecessary require statement `require(uint256(newState) <= uint256(States.OPEN), "Invalid state size"`

**[Q-4]** Adding allow-listed addresses 1 by 1 is very gas inefficient

Each Ethereum transaction has an initial fixed cost of 21_000 gas, which
is in addition to the cost of executing computation and storing variables
in the contract. By only allowing a single allowed address to be added
per function call, this is going to waste a lot of gas compared to a function
which takes in an array of allowlisted addresses and adds them in a single
transaction.

Consider changing the function to accept an `address[]` as an argument, where the function loops through these addresses adding them all in a single function call.


# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | 1    |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | -    |

Total: 1

Good job!
