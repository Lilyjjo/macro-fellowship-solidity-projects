//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;
import "./Project.sol";

contract ProjectFactory {
    event ProjectCreated(
        address newProject,
        uint256 goalAmount,
        string token_name
    );

    /**
     * @dev Creates a new 'Project' contract and logs the resulting
     * address in an event.
     */
    function create(
        uint256 goalAmount,
        string memory token_name,
        string memory token_symbol
    ) external {
        require(
            goalAmount >= .01 ether,
            "Minimum goal amount of .01 ETH required."
        );
        Project child = new Project(
            msg.sender,
            goalAmount,
            token_name,
            token_symbol
        );

        emit ProjectCreated(address(child), goalAmount, token_name);
    }
}
