## **Index**
- [**Index**](#index)
- [**Crowdfundr Audit Report**](#crowdfundr-audit-report)
- [**Static Analysis**](#static-analysis)
- [**[H-1]** Attacker can mint badges without contributing 1 ETH](#h-1-attacker-can-mint-badges-without-contributing-1-eth)
- [**[L-1]** Incrementing storage variables inside loop](#l-1-incrementing-storage-variables-inside-loop)
- [**[L-2]** Attacker could surpass targetGoal with reentrancy calls](#l-2-attacker-could-surpass-targetgoal-with-reentrancy-calls)
- [**[Q-1]** checkFailed change state and then reverts](#q-1-checkfailed-change-state-and-then-reverts)
- [**[Q-2]** Using transfer() may lead to the transaction to revert](#q-2-using-transfer-may-lead-to-the-transaction-to-revert)
- [**[Q-3]** Variables should use mixedCase notation](#q-3-variables-should-use-mixedcase-notation)


## **Crowdfundr Audit Report**

This contract aims to create crowdfund projects that raises a fixed quantity of ETH. If the goal target is met in within the 30 days of the creation, the project creator can withdraw its funds. If the project fails or gets cancelled by the creator, any contributor can refund his contributions. The contributor gets rewarded an NFT Badge per 1 ETH of contribution to the project.

This micro audit was conducted by Agustin Bravo student of block 6 of the Macro Solidity bootcamp.

## **Static Analysis**

The execution of static analysis _slither_ identified 54 potential issues within the codebase of which 50 were ruled out to be false positives or negligible findings. The mayority of the potencial issues where from inherited contracts and not used functions from them.

The remaining 3 issues were validated and grouped and formalized into the 2 points:

- Incrementing storage variables inside loop. (Low severity)
- Variables should use mixedCase notation. (Code quality)

## **[H-1]** Attacker can mint badges without contributing 1 ETH

On line 110, Project.sol has the following code:

```
uint256 wholeEthInNew = (_contributions[msg.sender] + msg.value) /
    (10**18);
uint256 wholeEthInOriginal = _contributions[msg.sender] / (10**18);
while (wholeEthInNew > wholeEthInOriginal) {
    _safeMint(msg.sender, _nextTokenId++);
    wholeEthInOriginal++;
``` 

This code creates a reentrancy vulnerability. Because the wholeEthInOriginal is not updated until _after_ the `_safeMint` call. Since `_safeMint` in ERC721 calls `onERC721Received()` in `_to` address an attacker's contract can re-call this function to mint more tokens without contributing 1 ETH.

Consider: Updating `wholeEthInOriginal` state _before_ making the minting.

## **[L-1]** Incrementing storage variables inside loop

On line 113, Project.sol has the following code:
  
```
while (wholeEthInNew > wholeEthInOriginal) {
    _safeMint(msg.sender, _nextTokenId++);
    wholeEthInOriginal++;
}
```

Incrementing `_nextTokenId` in a loop incurs a lot of gas because of expensive `SSTORE`s, which might lead to an out-of-gas in big contributions.

Consider: Creating a local variable before the loop and assign it the current value of `_nextTokenId`. Then use the new local variable inside the `_safeMint` function. After the loop assign the state of global variable to the local counter.

## **[L-2]** Attacker could surpass targetGoal with reentrancy calls

On line 110, Project.sol has the following code:

```
uint256 wholeEthInNew = (_contributions[msg.sender] + msg.value) 
    (10**18);
uint256 wholeEthInOriginal = _contributions[msg.sender] / (10**18);
while (wholeEthInNew > wholeEthInOriginal) {
    _safeMint(msg.sender, _nextTokenId++);
    wholeEthInOriginal++;
}

// update balances and see if goal is met
_contributions[msg.sender] += msg.value;
_amountInContributions += msg.value;
```

This code creates a reentrancy vulnerability. Because the `_amountInContributions` is not updated until _after_ the `_safeMint` call. Since `_safeMint` in ERC721 calls `onERC721Received()` in `_to` address an attacker's contract can re-call this function create transactions and surpass the `_goal` before reaching line 122 where the `_amountInContributions` is compared to the `_goal`.

Consider: Updating `_contributions[msg.sender]` and `_amountInContributions` state _before_ making the minting.

## **[Q-1]** checkFailed change state and then reverts

On line 50, Project.sol has the following modifier declaration:

```
modifier checkFailed() {
    if (_state == ProjectStates.ACTIVE && _expireTime <= block.timestamp) {
        _state = ProjectStates.FAILED;
    }
    _;
}
```

In function `contribute()` this modifier is used to verify if `_expireTime <= block.timestamp` in the case that the conditions are met the `_state` gets updated to `ProjectStates.FAILED`. After on line 100 we have the following code:

```
require(
        _state == ProjectStates.ACTIVE,
        "Project not accepting contribtuions anymore."
    );
```

Since the value of `_state` is different than the required the transaction will revert and the value of `_state` will go back to `ProjecetStates.ACTIVE` spending unnecessary gas.

Consider: Using a view function and returning the corresponding ProjectState to improve readability of the code.

## **[Q-2]** Using transfer() may lead to the transaction to revert

On line 147, Project.sol has the following modifier code:

```
payable(_creator).transfer(amount);
```

And on line 165, Project.sol has the following code:

```
payable(msg.sender).transfer(amountToReturn);
```

Function `transfer()` sends hardcoded 2300 gas to the caller to execute fallback function. Gas cost of functions can and will change in future versions of solidity (As EIP 1884 did changing `SLOAD` cost from 200 gas to 800 gas).

Consider: Function call in combination with re-entrancy guard is the recommended method to use after December 2019. (Source: https://solidity-by-example.org/sending-ether)

## **[Q-3]** Variables should use mixedCase notation

On line 110, Project.sol has the following code:

```
constructor(
    address creator,
    uint256 goal,
    string memory token_name,
    string memory token_symbol
) ERC721(token_name, token_symbol) {
    _creator = creator;
    _state = ProjectStates.ACTIVE;
    _goal = goal;
    _expireTime = block.timestamp + 30 days;
}
```

Parameter variables `token_name` and `token_symbol` should be using mixedCase (`tokenName` and `tokenSymbol` for ex)

Consider: Using mixedCase notation for all variables declaration. (https://docs.soliditylang.org/en/latest/style-guide.html#naming-styles)
