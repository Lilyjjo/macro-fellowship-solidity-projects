I learned quite a bit from this implementation. I had to dig deep to come up with areas of improvement. Here's probably the biggest thing you can take away from this audit:

> "So much complexity in software comes from trying to make one thing do two things"
> -- Ryan Singer

[T-1] Mismatched tax value calculation

On line 54, `SpaceCoinLPRouter.sol` has the following lines:

    ```
    if (inputAisSPC) {
        // spc is taxed going in to a smaller amount
        uint256 liquidityA = (((inputA * 98) / 100) * totalLiquidity) /
            reserveA;
        inputB = (reserveB * liquidityA) / totalLiquidity;
    } else {
        // inflate spc to equal eth amount
        uint256 liquidityA = ((inputA) * totalLiquidity) / reserveA;
        inputB = ((((reserveB * liquidityA) / totalLiquidity) * 100) /
            98);
    }
    ```

Your SpaceCoin.sol does subtractive taxing, whereas these lines do multiplicative. That will create rounding errors and differences in calculations. Subtractive is a much better solution in general, since the 2 parts sum back up to the original. Whereas multiplicative taxing will often result in 2 parts that sum to something less than the original. To give a more concrete example, imagine transferring 99 SPC. How much would be left once taxed?

A) Subtractive:
Tax amount is 2%
= (99 \* 2) / 100
= 1.98
= 1 (rounded down)

Remainder:
= 99 - 1 = 98 SPC left

B) Multiplicative:
Tax amount is 2%
Therefore the remainder is 98%
= (99 \* 98) / 100
= 97.02
= 97 SPC LEFT

The difference is just 1 WEI worth of SPC, this this is too small to be a security vulnerability.

Consider: Going back to subtractive taxation on your router calculation.

[T-2] Unnecessary contract property management

On lines 21, 76, 78, 84, 108, 110, 111 and 121, `SpaceCoinLP.sol` has references to a contract property: `uint256 public totalLiquidity;`

`totalLiquidity` seems to be a proxy for the ERC-20 `totalSupply`. We increment it by new liquidity when we mint, and we decrement it by burnt liquidity whenever we burn. There's quite a bit of code that maintains this value. However, this value could be completely removed, and `totalSupply()` could be used instead.

[Q-1] Reduce complexity:

On line 41, `SpaceCoinLPRouter.sol` has the following lines:

    ```
    function matchLiquidity(
            uint256 inputA,
            uint256 reserveA,
            uint256 reserveB,
            uint256 totalLiquidity,
            bool spcTaxOn,
            bool inputAisSPC
        ) public pure returns (uint256 inputB) {
    ```

This function has some argument overcrowding. The last argument `bool inputAisSPC` creates a particularly complex situation by changing the meaning and interpretation of the previous arguments based on its value. That's usually a telltale sign that the function is doing the job of 2 functions. The added complexity makes it difficult to focus on the business requirements.

Consider: Creating 2 different functions. One for matching SPC to ETH, the other for matching ETH to SPC.

[Q-2] Unnecessary computation

On line 51, `SpaceCoinLPRouter.sol` has the following lines:

    ```
    if (!spcTaxOn) {
        uint256 liquidityA = (inputA * totalLiquidity) / reserveA;
        inputB = (reserveB * liquidityA) / totalLiquidity;
    }
    ```

Notice how totalLiquidity is used both for multiplication and division.

Consider: Reducing these 2 lines down to a single line:

`inputB = (reserveB * inputA) / reserveA;`

[Q-3] Reduce complexity:

On line 92, `SpaceCoinLPRouter.sol` has the following function:

```
function addLiquidity(uint256 desiredSPCAmount) external payable {
```

This function is 50 lines long and handles multiple, complex use cases. One such usecase is determining whether to take ETH as the basis of the mint pair, versus SPC. It makes this decision by looking at the given argument `desiredSPCAmount` and seeing if it's zero.

Consider: Instead of having implicit control flows depending on the values of certain arguments, try having explicit and separate functions that do very specific things. You'll end up writing basically the same number of lines, but they will be easier to develop and comprehend. For instance:

```
function addLiquidityWithExactSPC(uint256 desiredSPCAmount) external payable {
  ///
}

function addLiquidityWithExactETH() external payable {
  ///
}

```

[Q-4] Reduce complexity

On line 92, `SpaceCoinLPRouter.sol` has the following function:

```
function swap(
    uint256 desiredOutputETH,
    uint256 desiredOutputSPC,
    uint256 maxAmountIn
) external payable {
```

This function is essentially 2 functions that are stuck together through a major if/else.

Consider: Separating them and calling them `swapSPCForExactEth` and `swapETHForExactSPC`. This is how uniswap does it too.
