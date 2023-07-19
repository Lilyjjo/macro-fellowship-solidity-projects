
https://github.com/0xMacro/student.Lilyjjo/tree/949de286a902a4d79530b89a6a758e0cc8cba5d6/lp

Audited By: Vince

# General Comments

Very well done! Everything is in place, well written, well documented and well tested (pretty much 100% coverage). I'm glad to say it's a 0 score!


# Design Exercise

I like the idea you presented, simple and effective. I think the liquidity providers would be very happy to stake their LP tokens into a new contract with more rewards coming their way!


# Issues

**[Q-1]** `totalLiquidity` in SpaceCoinLP is redundant with ERC20 `_totalSupply`

Given that `SpaceCoinLP` is a ERC20 token, `totalSupply` is tracked already by the OZ implementation therefore tracking changes in supply using a new storage variable is redundant and wastes gas.

Consider leveraging `_totalSupply` instead of tracking changes in `totalLiquidity`.

**[Q-2]** Interfaces vs. contract imports

Your contract SpaceCoinLPRouter.sol and SpaceCoinLP.sol import other contracts. This effectively copies those contracts into the code of your router and lp contract. This does make it easy to then call functions from the imported contracts, but it greatly increases contract size and deployment costs.

Consider using interfaces for these contracts. It would cut down on contract size and deployment costs.

**[Q-3]** Unnecessary arithmetics

In SpaceCoinLP.sol `burn` and `swap` functions there is some unnecessary arithmetics to update the reserve values. Notice that if the functions weren't locked with the re-entrancy protection the arithmetics would have been mandatory instead.

Consider capturing the ETH and SPC balances in the reserve variables after transfering the assets.


# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | - |
| Vulnerability              | - |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 0

Awesome submission!
