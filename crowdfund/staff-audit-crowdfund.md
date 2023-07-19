https://github.com/0xMacro/student.Lilyjjo/tree/1290d6865c9ae692afb716f37b7dee7c8bca0a86/crowdfund

Audited By: Gary

# General Comments

- Good first project.  Be careful of the styling of your contracts. Typically, having the first character of a variable 
starting with underscore is not encouraged.  In addition, events usually are placed before functions

see:  [official style guide](https://docs.soliditylang.org/en/v0.8.9/style-guide.html)

- You had 3 vulnerabilities, but none were high.   When using _safeMint you need to watch out for the re-entrancy 
vulnerability as described in class.  (see below).  Also, make sure you do the follow the [Checks-Effects-Interactions pattern](https://docs.soliditylang.org/en/v0.8.9/security-considerations.html) - always update state variables before any external calls. 

- Furthermore, as discussed in class, when sending ETH, the `call` function should be used instead of `transfer`.  (see below) 

(Here is an article referencing the difference  https://medium.com/coinmonks/solidity-transfer-vs-send-vs-call-function-64c92cfc878a)

- I have identified several code quality issues. Please follow the recommendations for your next projects. Your code quality
will improve and eventually become rock solid!

Excellent text coverage. 

Overall good start to the course!


# Design Exercise

A good idea to create a mapping for the token tier.  But how would you implement it? Please be a little more detail on
your next design exercise.   

# Issues

**[M-1]** Reentrancy allows for greater than expected number of badge mints

In line 113 of Project.sol, the number of NFT's to mint gets determined by subtracting the number of badges received so far
from the amount of ETH contributed. Then, you mint the badges (using _safeMint) **before updating the number of badges received**. This means a malicious contributor can re-enter the contract, contribute the minimum amount of ETH (0.01 ETH),
 but still get an additional NFT.

You can prevent this by moving the line of code  (line: 115) that increments the number
of badges received to be before the external `_safeMint` call. (between line 113 and line 114)

**[L-1]** Reentrancy can lead to surpassing the goal on the contract

Another reentrancy vulnerability is created by updating the `_amountInContributions` line 120 after the _safeMint function.
The _safeMint function in the openzeppelin ERC721 contract calls onERC721Received() which is an external function call. This creates a security loophole. Specifically, the attacker can perform a reentrant call inside the onERC721Received callback.  It can call `contribute` again, which will not capture the new ETH in the contract total, and allow the amount contributed to surpass the goal amt.  

Consider moving lines 119 and 120 to between line 112 and 113 prior to the minting. 
```
_contributions[msg.sender] += msg.value;
_amountInContributions += msg.value;
```

**[L-2]** Use of transfer 

Your contract uses the `transfer()` function to send ETH. Although this will work it is no longer the recommended approach. 
`transfer()` limits the gas sent with the transfer call and has the potential to fail due to  rising gas costs. `call()` is 
currently the best practice way to send ETH.

For a full breakdown of why, check out [this resource](https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/)
 
For example: instead of using

```
payable(someAddress).transfer(amount);
```

The alternative, admittedly somewhat clumsy looking, recommendation is:

```
(bool success,) = payable(someAddress).call{value:amount}("");
require(success, "transfer failed"
```

Consider replacing your `transfer()` functions with `call()` to send ETH.


**[Extra Feature-1]**  Extra getter functions

You called 3 separate getter functions (lines 76-92 in `Project.sol`)  for _creator, _goal, and _amountInContributions. 
These were not in the spec.  If user needs access to these variables, then these variables should be defined as public 
and not private. Declaring a public variable automatically generates getter functions.  This saves on gas. 

**[Q-1]** Incrementing storage state variable inside a loop 

On line 113 in `Project.sol` 
```
while (wholeEthInNew > wholeEthInOriginal) {
    _safeMint(msg.sender, _nextTokenId++);
    wholeEthInOriginal++;
```

the storage varaible _nextTokenId is being incremented inside the while loop.  This increases gas costs because
of SSTOREs are expensive.  This could lead to exceeding the gas amount for larger contributions. 

Consider: assigning _nextTokenId to a local variable prior to the loop, and increment the new local variable inside the loop. Once loop ends, then reassign _nextTokenId to the local variable, 

**[Q-2]**  Use immutable variables

There are a number of variables set in the constructor that don't change. These can be made immutable. See https://docs.soliditylang.org/en/v0.8.9/contracts.html#constant-and-immutable-state-variables

FYI

Unchanged variables should be marked constant or immutable

Contracts that includes storage variables that are not updated by any functions and do not change can save gas and improve readability by marking these variables as either constant or immutable.

What's the difference? In both cases, the variables cannot be modified after the contract has been constructed. For constant variables, the value has to be fixed at compile-time, while for immutable, it can still be assigned at construction time.

Compared to regular state variables, the gas costs of constant and immutable variables are much lower. For a constant variable, the expression assigned to it is copied to all the places where it is accessed and also re-evaluated each time. This allows for local optimizations. Immutable variables are evaluated once at construction time and their value is copied to all the places in the code where they are accessed. For these values, 32 bytes are reserved, even if they would fit in fewer bytes. Due to this, constant values can sometimes be cheaper than immutable values.

Consider marking unchanged storage variables after being updated in the constructor as immutable.

**[Q-3]** Long Error Messages

Long error messages cost you. Generally, try to keep error messages 
[below 32 ASCII characters](https://medium.com/@chebyk.in/how-big-is-solidity-custom-error-messages-overhead-1e915724b450).

If you feel you need longer error messages, it's best practice to store them
within your client/front end.

Instead of:
```
require( _state == ProjectStates.SUCCESS,
            "Project cannot be withdrawn from at this time."
        );
```

Consider:

```
require( _state == ProjectStates.SUCCESS,
            "WITHDRAW_FORBIDDEN")
        );
```

**[Q-4]** Private storage variables: 

Private variables are useful for when you don't want inherited contracts 
to alter those storage variables. For example, contract B imports contract A 
and contract A has a private variable V. From contract B, you cant change 
variable V. Since we aren't designing these contracts for inheritance, 
use of `private` is not required.

In other cases, you might be sure that a storage variable never needs
to be accessed outside of your contract functions (ex: in DAPP front ends,
other contracts that interact with yours), and in that case making a storage
variable `private` can reduce initial contract deploy gas because a 
default getter function will not be generated.

In addition, "private" doesn't actually mean those variables are un-readable; 
unless you encrypt storage variables then they are readable by anyone who has 
the technical skills to read contract's storage slots (e.g. using the JSON 
RPC function getStorageAt). In general, you want storage variables to be 
open so that other humans and other contracts can read important information 
about your contract. Only the clearly low-level, non-pertinent variables 
should be private.

Consider changing your storage variables visibility to 'public'.

**[Q-5]**  Unnecessary initializing of state variable 

In the constructor function in `Project.sol` at line 68, the variable _state is being re-initializes to the active status.
If you would restructure the enum ProjectStatus, this would not be needed

Instead of

```
enum ProjectStates {
        FAILED,
        SUCCESS,
        ACTIVE
    }
```

Consider: 

```
enum ProjectStates {
        ACTIVE
        SUCCESS,
        FAILED,
    }
```

The different statuses equate to 0, 1, 2 respectively, and variable ProjectStates default value will be 0 which will equate 
to ACTIVE. 

**[Q-6]**  Event attributes not indexed

You can add the attribute 'indexed' to up to three parameters which adds them to a special data structure known as “topics” instead of the data part of the log.

Topics allow you to search for events, for example when filtering a sequence of blocks for certain events. You can also filter events by the address of the contract that emitted the event.

see: https://docs.soliditylang.org/en/develop/contracts.html#events

**[Q-7]** Use NatSpec format for comments

Solidity contracts can use a special form of comments to provide rich 
documentation for functions, return variables and more. This special form is 
named the Ethereum Natural Language Specification Format (NatSpec).

It is recommended that Solidity contracts are fully annotated using NatSpec 
for all public interfaces (everything in the ABI).

Using NatSpec will make your contracts more familiar for others audit, as well
as making your contracts look more standard.

For more info on NatSpec, check out [this guide](https://docs.soliditylang.org/en/develop/natspec-format.html).

Consider annotating your contract code via the NatSpec comment standard.

# Nitpicks

- Some of your code style choices (e.g., underscoring storage variables) are a bit unconventional for Solidity. While 
  variation does exist, you may consider consulting the [official style guide](https://docs.soliditylang.org/en/v0.8.9/style-guide.html)

- Optimize your code to reduce bytecode and deployment cost by setting optimizer in the hardhat config file.
  Melville stressed this in class   refer to: https://hardhat.org/config

  ```
  settings: {
      optimizer: {
        enabled: true,
        runs: 200
  ```


# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 1 |
| Vulnerability              | 4 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 5

Good Job!  
