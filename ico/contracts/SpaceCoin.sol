//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/** @title An ERC20 contract 'SpaceCoin'
 * @author Lily Johnson
 * @notice This is a standard ERC20 with a toggled 2% tax,
 * 500,000 total supply and 18 decimal places.
 */
contract SpaceCoin is ERC20 {
    address public immutable owner;
    address public immutable treasury;

    uint256 private constant TAX_PERCENT = 2;
    bool public tax;

    event TaxChanged(bool tax);

    constructor(address owner_, address treasury_) ERC20("SpaceCoin", "SPC") {
        owner = owner_;
        treasury = treasury_;
        tax = false;

        _mint(treasury_, 350_000 ether);
        _mint(msg.sender, 150_000 ether);
    }

    /** @notice Changes the tax to the supplied state. Only the
     * owner can call and will revert if the state is the same.
     * @param tax_ The state to set the tax to.
     */
    function setTax(bool tax_) external {
        require(msg.sender == owner, "Only owner can set tax");
        require(tax != tax_, "Tax already set");
        tax = tax_;
        emit TaxChanged(tax);
    }

    /** @notice Transfers SPC from the caller to the 'to' address.
     * Will take a 2% cut from the transfer to add to the
     * treasury if tax is enabled.
     * @param to The address to receive the SPC
     * @param amount The number of SPC to transfer
     */
    function transfer(address to, uint256 amount)
        public
        override
        returns (bool)
    {
        address from = _msgSender();

        if (tax) {
            uint256 originalAmount = amount;
            uint256 taxAmount = (originalAmount * TAX_PERCENT) / 100;
            uint256 postTaxAmount = originalAmount - taxAmount;
            assert(originalAmount == taxAmount + postTaxAmount);
            _transfer(from, to, postTaxAmount);
            _transfer(from, treasury, taxAmount);
        } else {
            _transfer(from, to, amount);
        }

        return true;
    }

    /** @notice Transfers SPC from the 'from' to the 'to' address.
     * The caller must have been approved for the amount.
     * Will take a 2% cut from the transfer to add to the
     * treasury if tax is enabled.
     * @param from The address to take the SPC from
     * @param to The address to receive the SPC
     * @param amount The number of SPC to transfer
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);

        if (tax) {
            uint256 originalAmount = amount;
            uint256 taxAmount = (originalAmount * TAX_PERCENT) / 100;
            uint256 postTaxAmount = originalAmount - taxAmount;
            assert(originalAmount == taxAmount + postTaxAmount);
            _transfer(from, to, postTaxAmount);
            _transfer(from, treasury, taxAmount);
        } else {
            _transfer(from, to, amount);
        }
        return true;
    }
}
