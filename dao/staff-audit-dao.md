https://github.com/0xMacro/student.Lilyjjo/tree/fa750ef96f91624a661496128da7b3de56dd9893/dao

Audited By: Thomas Taylor

# General Comments

Your solution is very good, you should be proud! I especially liked how you allowed bulk voting to recover from single vote failures and returned the status of each, I hadn't seen that before. Usage of natspec was appreciated and the contract is very informative when it comes to logging events. Some mistakes were made like calculating and storing the quorum as a percentage and unfortunately a vulnerability in your bulk voting but that didn't detract too much. Documentation in the README.md was very clear and readable - proposal states and NFT purchasing were understandable.

# Design Exercise

Your answers were extremely thoughtful and well-done, thank you! Having code alongside is extremely helpful to understand what you are trying to communicate. You nailed the considerations in the second question. It's expensive for the end-user to traverse a large map (or chain) of delegations. 

# Issues

**[M-1]** Off-chain bulk voter can vote infinitely for any non-member EOA

In the function `voteOffChainBulk()`, on line 207, a `false` flag is passed to the `_vote()` function. This allows this area to be more durable for voting checks from false voters. However in the `_vote()` function when this check is made, on line 464, the `msg.sender` is checked in the `members` collection. If the relayer already exists as a member, then any valid signature from an EOA account will be able to vote here, bypassing the members check.

Instead, consider checking the `member` instead of the `msg.sender`.

**[M-2]** Quorum storage introduces vulnerability

On line 281, the quorum is stored as `quorumRequirement`. This takes a snapshot of what the quorum would be however, new members can be added over time. And on line 407, this snapshot quorum is checked against the sum of yes and no votes at the current point in time.

Consider eliminating quorum calculation at proposal creation time or adding snapshot functionality that would allow you to capture users voting power at a certain time.

**[Technical Mistake]** Quorum math is not correct when there are few DAO members

On line 273 of CollectorDao.sol, quorum is snapshotted for a proposal. However, for small values of `memberCount`, like 7 for instance, you'll get 1.75 which actually will store `1`. So when checking for quorum on line 407, you'll have an erroneuous quorum with 1 yes vote for 7 members.

Consider multiplying by 4 and the total yes+no votes by 100 to get the true quorum. This will not drop precision when comparing large values.
<!---more detail--->

**[Q-1]** Storing calldata, targets, values on-chain

Consider storing these on-chain as the hash of the parts solely and then it'll make things a bit easier for your users from a gas perspective. Storing large calldata is expensive!

# Nitpicks

* The nftProposal function is somewhat redundant - `_nftProposal` is acceptable as-is! It actually works very well for what you are intending. Instead I would consider using `execute()` to call `_nftProposal` so that `msg.sender` was the contract address.
* Execution windows are really annoying in the real world - if implementing a proper DAO, a personal preference is to start the execution window after the last successful vote is tallied. This isn't really a nitpick, just feedback for real world implementations. It's hard to coordinate DAO members together to do anything.
* Consider using a proposalID that's a hash of the contents instead of an on-chain counter - this helps with SLOADs and in general is about as unique as an incremeting counter.

# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | - |
| Vulnerability              | 4 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | 1 |

Total: 5

Good job!
