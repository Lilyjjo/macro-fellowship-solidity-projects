//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./SpaceCoin.sol";
import "hardhat/console.sol";

/** @title An ICO contract
 *  @author Lily Johnson
 *  @notice This is a 3 tiered ICO where:
 *   - Seed tier where allowlisted individuals can contribute up to 1,500
 *     ETH with a tier max of 15,000 ETH
 *   - General tier where anyone can contribute up to 1,000 ETH up to
 *     30,000 ETH
 *   - Open tier where anyone can contribute with no max
 *   - Funds become available in the Open tier
 *   - 5 SPC per ETH contributed
 *  @dev There is currently no way to withdraw ETH
 **/
contract SpaceICO {
    SpaceCoin public immutable spaceCoin;
    address public immutable owner;

    uint256 private constant SEED_CONTRIBUTION_LIMIT = 1_500 ether;
    uint256 private constant GENERAL_CONTRIBUTION_LIMIT = 1_000 ether;
    uint256 private constant ICO_SEED_LEVEL_LIMIT = 15_000 ether;
    uint256 private constant ICO_LIMIT = 30_000 ether;

    mapping(address => bool) public allowList;
    bool public paused;
    States public state;

    uint256 public icoAllocationLeft;
    mapping(address => uint256) public contributionBalances;

    // States the project can be in
    enum States {
        SEED,
        GENERAL,
        OPEN
    }

    event Contribution(address indexed contributor, uint256 amount);
    event Transfer(address indexed redeemer, uint256 amount);
    event NewState(States state);
    event Paused(bool paused);
    event InvestorAdded(address indexed contributor);

    /**
     * @notice Restricts the call to only the contract's owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, "Only the owner can call");
        _;
    }

    constructor(address owner_, address treasury_) {
        spaceCoin = new SpaceCoin(owner_, treasury_);
        paused = false;
        icoAllocationLeft = ICO_LIMIT;
        owner = owner_;
    }

    /**
     * @notice Moves the contracts State forward to the new level.
     * @param newState The state to set the contract to.
     */
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

    /**
     * @notice Adds an address to the list of approved seed investors.
     * @param investor The address to approve
     */
    function addAllowlist(address investor) external onlyOwner {
        require(!allowList[investor], "Investor already added");
        allowList[investor] = true;
        emit InvestorAdded(investor);
    }

    /**
     * @notice Pauses or unpauses adding new funds to the contract
     * @param paused_ State to set to the `paused` variable
     */
    function setPaused(bool paused_) external onlyOwner {
        require(paused != paused_, "Paused already in that state");
        paused = paused_;
        emit Paused(paused);
    }

    /**
     * @notice Allows contributors to add funds to the contract.
     *   Different restrictions are applied based on the state of
     *   the contract.
     */
    function contribute() external payable {
        require(!paused, "ICO is paused");
        require(msg.value > 0);

        // check for allowlist if needed
        if (state == States.SEED) {
            require(allowList[msg.sender], "Not approved for seed phase");
        }

        // update balances and check under level limit
        if (state == States.SEED) {
            require(
                icoAllocationLeft >= ICO_SEED_LEVEL_LIMIT + msg.value,
                "Amount > than seed space left"
            );
        } else {
            require(
                icoAllocationLeft >= msg.value,
                "Amount > than ICO space left"
            );
        }
        icoAllocationLeft -= msg.value;

        // check individual contribution limit
        uint256 totalContribution = msg.value +
            contributionBalances[msg.sender];

        if (state == States.GENERAL) {
            require(
                totalContribution <= GENERAL_CONTRIBUTION_LIMIT,
                "Individual general limit hit"
            );
        } else if (state == States.SEED) {
            require(
                totalContribution <= SEED_CONTRIBUTION_LIMIT,
                "Individual seed limit hit"
            );
        }

        emit Contribution(msg.sender, msg.value);

        // reserve or mint tokens
        if (state == States.OPEN) {
            emit Transfer(msg.sender, msg.value * 5);
            spaceCoin.transfer(msg.sender, msg.value * 5); // TODO check to make sure decimals are corret
        } else {
            contributionBalances[msg.sender] += msg.value;
        }
    }

    /**
     * @notice Allows pre-Open tier contributors to redeem their funds.
     */
    function redeemSpaceCoin() external {
        require(state == States.OPEN, "ICO isn't open yet");

        uint256 contributionBalance = contributionBalances[msg.sender];
        require(contributionBalance > 0, "No tokens to claim");

        contributionBalances[msg.sender] = 0;
        emit Transfer(msg.sender, contributionBalance * 5);

        spaceCoin.transfer(msg.sender, contributionBalance * 5);
    }

    /**
     * @notice Transfers ETH funds to designated address.
     */
    function transfer(address to) external onlyOwner {
        (bool success, ) = payable(to).call{value: address(this).balance}("");
        require(success, "Transfer Failed");
    }
}
