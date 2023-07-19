//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Project is ERC721, Ownable {
    // Events
    event Contribution(address contributor, uint256 amount);
    event Withdraw(uint256 amount, uint256 amountLeft);
    event Refund(address contributor, uint256 amount);
    event ProjectSuccess();
    event ProjectCancelled();

    // States the project can be in
    enum ProjectStates {
        FAILED,
        SUCCESS,
        ACTIVE
    }

    // Target goal amount
    uint256 private _goal;
    // Creator of the project
    address private _creator;
    // Time when project is considered 'failed' if goal not met
    uint256 private _expireTime;
    // Current state of the project
    ProjectStates private _state;
    // Amount of contributions in contract
    uint256 private _amountInContributions;
    // Next tokenId to distribute
    uint256 private _nextTokenId;

    // Mapping contributor address to amount contributed
    mapping(address => uint256) private _contributions;

    /**
     * @dev Throws if called by any account other than the project creator.
     */
    modifier onlyCreator() {
        require(_creator == msg.sender, "Only the creator can call");
        _;
    }

    /**
     * @dev Checks to see if the contract has expired.
     */
    modifier checkFailed() {
        if (_state == ProjectStates.ACTIVE && _expireTime <= block.timestamp) {
            _state = ProjectStates.FAILED;
        }
        _;
    }

    /**
     * @dev Initializes the contract by setting the creator, goal amount, expire time,
     * and  a `name` and a `symbol` to the token collection.
     */
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

    /**
     * @dev Returns who the Project's creator is.
     */
    function getCreator() external view returns (address) {
        return _creator;
    }

    /**
     * @dev Returns the Project's goal amount.
     */
    function getGoalAmount() external view returns (uint256) {
        return _goal;
    }

    /**
     * @dev Returns what the Project's current contribution amount is.
     */
    function getCurrentAmount() external view returns (uint256) {
        return _amountInContributions;
    }

    /**
     * @dev Lets the msg.sender contribute at least .01 ETH if the project
     * is still active. Will reward the contributor with 1 badge per 1
     * cummulative ETH contributed.
     */
    function contribute() external payable checkFailed {
        require(
            _state == ProjectStates.ACTIVE,
            "Project not accepting contribtuions anymore."
        );
        require(
            msg.value >= .01 ether,
            "Minimum contribution amount of .01 ETH not met."
        );

        // check to see if contributor gets badges for this contribution
        uint256 wholeEthInNew = (_contributions[msg.sender] + msg.value) /
            (10**18);
        uint256 wholeEthInOriginal = _contributions[msg.sender] / (10**18);
        while (wholeEthInNew > wholeEthInOriginal) {
            _safeMint(msg.sender, _nextTokenId++);
            wholeEthInOriginal++;
        }

        // update balances and see if goal is met
        _contributions[msg.sender] += msg.value;
        _amountInContributions += msg.value;

        if (_amountInContributions >= _goal) {
            _state = ProjectStates.SUCCESS;
            emit ProjectSuccess();
        }

        emit Contribution(msg.sender, msg.value);
    }

    /**
     * @dev Lets creator withdraw an amount from a successful project's
     * contribution pool.
     */
    function withdraw(uint256 amount) external onlyCreator {
        require(
            _state == ProjectStates.SUCCESS,
            "Project cannot be withdrawn from at this time."
        );
        require(
            amount <= _amountInContributions,
            "Amount to withdraw greater than funds available."
        );
        _amountInContributions -= amount;

        emit Withdraw(amount, _amountInContributions);

        payable(_creator).transfer(amount);
    }

    /**
     * @dev Lets contributors reclaim their funds from a failed project.
     */
    function refund() external checkFailed {
        require(
            _state == ProjectStates.FAILED,
            "Project not currently refundable."
        );
        require(_contributions[msg.sender] > 0, "No funds to reclaim.");

        uint256 amountToReturn = _contributions[msg.sender];
        _contributions[msg.sender] = 0;

        emit Refund(msg.sender, amountToReturn);

        payable(msg.sender).transfer(amountToReturn);
    }

    /**
     * @dev Lets the project creator cancel the project if it is still active.
     */
    function cancel() external onlyCreator checkFailed {
        require(
            _state == ProjectStates.ACTIVE,
            "Cannot cancel project that is not in an active state."
        );
        _state = ProjectStates.FAILED;
        emit ProjectCancelled();
    }
}
