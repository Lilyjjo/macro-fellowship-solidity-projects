# Goerli Testnet Deets

SpaceICO deployed to: 0xb3A7d96174D337188B412Df71ab6aCc0DF9520C6 (https://goerli.etherscan.io/address/0xb3A7d96174D337188B412Df71ab6aCc0DF9520C6)

SpaceCoin deployed to: 0xFD2B2C60619230C8fB06bB00ea257d0767186aA8 (https://goerli.etherscan.io/address/0xFD2B2C60619230C8fB06bB00ea257d0767186aA8)

SpaceCoinLP deployed to: 0x5655A22f8BC5d130cF636473DC0361D78EB73A50 (https://goerli.etherscan.io/address/0x5655a22f8bc5d130cf636473dc0361d78eb73a50)

SpaceCoinLPRouter deployed to: 0xe25116efc07A68EBFB5a35Fe859e440b70A38f64 (https://goerli.etherscan.io/address/0xe25116efc07A68EBFB5a35Fe859e440b70A38f64)

# Design Exercise

Question: How would you extend your LP contract to award additional rewards – say, a separate ERC-20 token – to further incentivize liquidity providers to deposit into your pool?


Answer:

I'd try to incentivize people to keep their liquidity in the pool (and add more liquidity) by adding a new type of tax to the pool which would be given to the longterm `SPC-LP` holders.

`SPC-LP` holders would be able to lock their current `SPC-LP` tokens into a new smart contract which keeps track of how long their `SPC-LP` has been locked up, rewarding the locked `SPC-LP` with a new erc20 token `heldSPC-LP`. The locked `SPC-LP` would grow new `heldSPC-LP` at a rate of 1 new `heldSPC-LP` per locked `SPC-LP` every 6000 blocks (around a dayish). This `heldSPC-LP` would be non-tradeable, and, if users removed their `SPC-LP` from the pool they would automatically destory the `heldSPC-LP`, incentivizing the users to hold their original `SPC-LP`. Users would want `heldSPC-LP` because it would entitle them to a cut of a new and additional 1% tax on the LP pool's trades based on their proportional amount of total `helpdSPC-LP`. So, the longer that a user would have their `SPC-LP` locked up, the greater their share of the new contract's reward pool. Users can keep their `SPC-LP` in the new smart contract and claim the `heldSPC-LP` based rewards anytime that they would like.

This idea came from reading the failed-once BeanStalk Stablecoin protocol which does something a little more complex.
