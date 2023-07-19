//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface NftMarketplace {
    function getPrice(address nftContract, uint256 nftId)
        external
        returns (uint256 price);

    function buy(address nftContract, uint256 nftId)
        external
        payable
        returns (bool success);
}

/**
 * @title CollectorDAO
 * @author Lily Johnson
 * @notice This is a DAO contract that enables 1:1 voting,
 * generic proposals, and a special NFT buying proposal.
 */
contract CollectorDAO {
    /// @notice Duration of a proposal's voting phase
    uint256 public constant PROPOSAL_VOTING_TIME = 8 days;
    /// @notice Duration of proposal's execution phase
    uint256 public constant PROPOSAL_EXECUTION_TIME = 16 days;
    /// @notice 25% quorum requirement
    uint256 public constant PROPOSAL_QUORUM_DENOMINATOR = 4;

    /// @notice Type hash to comply with EIP712
    bytes32 constant EIP712DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    /// @notice Type hash to comply with EIP712
    bytes32 constant VOTE_STATUS_TYPEHASH =
        keccak256("VoteStatus(bool vote,uint256 proposalID)");

    /// @notice Mapping of members
    mapping(address => bool) public members;
    /// @notice Number of paid members
    uint256 memberCount;

    /// @notice Mapping of all existing proposals
    mapping(uint256 => Proposal) public proposals;
    /// @notice next ID to assign proposal
    uint256 nextProposalId;

    /// @notice Proposal information
    struct Proposal {
        uint256 id;
        uint256 initTime;
        uint256 quorumRequirement;
        bool executed;
        uint256 voteYes;
        uint256 voteNo;
        mapping(address => VoteStatus) votes;
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
    }

    /// @notice Proposal states
    enum ProposalStates {
        VOTING,
        EXECUTION,
        EXECUTED,
        QUORUM_NOT_MET,
        FAILED,
        EXPIRED
    }

    /// @notice Vote states
    enum VoteStatus {
        NOT_VOTED,
        VOTED_YES,
        VOTED_NO
    }

    event NewMember(address indexed newMember);
    event Vote(uint256 indexed proposal, address indexed newMember, bool vote);
    event NewProposal(
        uint256 indexed proposalID,
        address indexed author,
        uint256 quorumRequirement,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas
    );
    event ProposalExecuted(uint256 indexed proposalID);
    event ReceivedNFT(address from, uint256 tokenID);
    event OffChainVoteStatus(
        address indexed from,
        bool vote,
        uint256 indexed proposalID,
        bool success
    );

    /**
     * @notice Anyone can purchase a membership for 1 ETH.
     */
    function buyMembership() external payable {
        require(!members[msg.sender], "Already a member");
        require(msg.value == 1 ether, "Expected 1 ETH to be sent");
        members[msg.sender] = true;
        ++memberCount;
        emit NewMember(msg.sender);
    }

    /**
     * @notice Allows members to vote on chain. Members can only
     * vote once per proposal.
     * @param vote The vote
     * @param vote The proposal to vote on
     */
    function voteOnChain(bool vote, uint256 proposalID) external {
        _vote(msg.sender, vote, proposalID, true);
    }

    /**
     * @notice Process an off-chain vote. Members can only
     * vote once per proposal.
     * @param vote The vote
     * @param vote The proposal to vote on
     * @param v Signature's v component
     * @param r Signature's r component
     * @param s Signature's s component
     */
    function voteOffChain(
        bool vote,
        uint256 proposalID,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // process signature
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256(bytes("CollectorDAO")), // name
                keccak256(bytes("1")), //version
                block.chainid, // Chain ID
                address(this)
            )
        );

        bytes32 voteStatusHash = keccak256(
            abi.encode(VOTE_STATUS_TYPEHASH, vote, proposalID)
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, voteStatusHash)
        );

        address signatory = ecrecover(digest, v, r, s);
        _vote(signatory, vote, proposalID, true);
        emit OffChainVoteStatus(signatory, vote, proposalID, true);
    }

    /**
     * @notice Process multiple offchain votes. Members can only
     * vote once per proposal. If a vote fails, the tallying continues.
     * @param votes The votes
     * @param proposalIDs The proposals to vote on
     * @param vs Signatures' v component
     * @param rs Signatures' r component
     * @param ss Signatures' s component
     * @return List of vote's success to execute
     */
    function voteOffChainBulk(
        bool[] memory votes,
        uint256[] memory proposalIDs,
        uint8[] memory vs,
        bytes32[] memory rs,
        bytes32[] memory ss
    ) external returns (bool[] memory) {
        require(
            proposalIDs.length == votes.length &&
                votes.length == vs.length &&
                vs.length == rs.length &&
                rs.length == ss.length,
            "Data length mismatch"
        );
        bool[] memory List = new bool[](proposalIDs.length);

        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256(bytes("CollectorDAO")), // name
                keccak256(bytes("1")), //version
                block.chainid, // Chain ID
                address(this)
            )
        );

        for (uint256 i = 0; i < votes.length; ++i) {
            bytes32 voteStatusHash = keccak256(
                abi.encode(VOTE_STATUS_TYPEHASH, votes[i], proposalIDs[i])
            );

            bytes32 digest = keccak256(
                abi.encodePacked("\x19\x01", domainSeparator, voteStatusHash)
            );

            address signatory = ecrecover(digest, vs[i], rs[i], ss[i]);
            List[i] = _vote(signatory, votes[i], proposalIDs[i], false);
            emit OffChainVoteStatus(
                signatory,
                votes[i],
                proposalIDs[i],
                List[i]
            );
        }

        return List;
    }

    /**
     * @notice Submits a proposal to buy an NFT with a
     * max price to spend. Costs 0.001 ETH to submit.
     * @param nftContract NFT Contract to buy from
     * @param nftMarketplace Marketplace contract
     * @param tokenID Token to purchase
     * @param maxPrice max price to spend
     */
    function nftProposal(
        address nftContract,
        address nftMarketplace,
        uint256 tokenID,
        uint256 maxPrice
    ) external payable {
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        string[] memory signatures = new string[](1);
        signatures[0] = "_nftProposal(address,address,uint256,uint256)";
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encode(
            nftContract,
            nftMarketplace,
            tokenID,
            maxPrice
        );
        makeProposal(targets, values, signatures, calldatas);
    }

    /**
     * @notice Submits a generic proposal. Costs .001 ETH to submit.
     * Must be a member.
     * @param targets Addresses to call
     * @param values ETH to send with call
     * @param signatures Function signatures to envoke
     * @param calldatas Calldata to send with function calls
     */
    function makeProposal(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas
    ) public payable {
        require(msg.value == .001 ether, "Expected .001 ETH to be sent");
        require(members[msg.sender], "Only members can propose");
        require(targets.length > 0, "Empty proposal");
        require(
            targets.length == values.length &&
                values.length == signatures.length &&
                signatures.length == calldatas.length,
            "Data length mismatch"
        );

        uint256 quorum = memberCount / PROPOSAL_QUORUM_DENOMINATOR;
        if (quorum == 0) {
            ++quorum;
        }

        uint256 proposalID = ++nextProposalId;
        proposals[proposalID].id = proposalID;
        proposals[proposalID].initTime = block.timestamp;
        proposals[proposalID].quorumRequirement = quorum;
        proposals[proposalID].targets = targets;
        proposals[proposalID].values = values;
        proposals[proposalID].signatures = signatures;
        proposals[proposalID].calldatas = calldatas;

        emit NewProposal(
            proposalID,
            msg.sender,
            quorum,
            targets,
            values,
            signatures,
            calldatas
        );
    }

    /**
     * @notice Executes the given proposal ID. Will revert if
     * any one call fails.
     * @param proposalId The proposal to execture
     */
    function execute(uint256 proposalId) external {
        require(
            proposalStatus(proposalId) == ProposalStates.EXECUTION,
            "Proposal not in execution state"
        );

        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; ++i) {
            bytes memory callData;

            if (bytes(proposal.signatures[i]).length == 0) {
                // is a straight call
                callData = proposal.calldatas[i];
            } else {
                bytes4 abiFuncSignature = bytes4(
                    keccak256(bytes(proposal.signatures[i]))
                );
                callData = abi.encodePacked(
                    abiFuncSignature,
                    proposal.calldatas[i]
                );
            }

            (bool success, ) = proposal.targets[i].call{
                value: proposal.values[i]
            }(callData);

            require(success, "Transaction failed");
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice The function which nftProposal invokes during
     * execution. Attempts to buy an NFT from the NFTMarket place.
     * Only callable by this contract.
     * @param nftContract NFT Contract to buy from
     * @param nftMarketplace Marketplace contract
     * @param tokenID Token to purchase
     * @param maxPrice max price to spend
     */
    function _nftProposal(
        address nftContract,
        address nftMarketplace,
        uint256 tokenID,
        uint256 maxPrice
    ) external {
        // The function needs to be external to be called via the `call()` function,
        // but also we only want this contract to call it.
        require(msg.sender == address(this), "Only callable via nftProposal()");

        NftMarketplace _nftMarketplace = NftMarketplace(nftMarketplace);
        uint256 price = _nftMarketplace.getPrice(nftContract, tokenID);
        require(price <= maxPrice, "Price higher than max");

        (bool success, bytes memory result) = payable(nftMarketplace).call{
            value: price
        }(
            abi.encodeWithSignature(
                "buy(address,uint256)",
                nftContract,
                tokenID
            )
        );

        require(success, "Transaction failed");
        bool purchased = abi.decode(result, (bool));
        require(purchased, "Purchased failed");
    }

    /**
     * @notice Allows contract to receive NFTs.
     */
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external returns (bytes4) {
        emit ReceivedNFT(from, tokenId);
        return this.onERC721Received.selector;
    }

    /**
     * @notice Returns the status of a proposal
     * @param proposalID The proposal to query
     * @return The status of a valid propsal
     */
    function proposalStatus(uint256 proposalID)
        public
        view
        returns (ProposalStates)
    {
        require(proposals[proposalID].id != 0, "Not a valid proposal");
        Proposal storage proposal = proposals[proposalID];

        if (block.timestamp < proposal.initTime + PROPOSAL_VOTING_TIME) {
            // still in voting phase
            return ProposalStates.VOTING;
        }

        if (proposal.quorumRequirement <= proposal.voteYes + proposal.voteNo) {
            // quorum met

            if (proposal.voteYes > proposal.voteNo) {
                // voting outcome was success
                if (proposal.executed) {
                    // proposal has been executed
                    return ProposalStates.EXECUTED;
                }

                if (
                    block.timestamp <=
                    proposal.initTime + PROPOSAL_EXECUTION_TIME
                ) {
                    // proposal can still be executed
                    return ProposalStates.EXECUTION;
                }

                // propsoal not executed and time has passed
                return ProposalStates.EXPIRED;
            } else {
                // voting outcome was negative
                return ProposalStates.FAILED;
            }
        }
        // time has passed and quorum not met
        return ProposalStates.QUORUM_NOT_MET;
    }

    /**
     * @notice Internal voting function
     * @param member The member voting
     * @param vote The vote
     * @param proposalID The proposal being voted on
     * @param doRevert If function should revert on failed conditions
     * @return True if the vote succeeded to be processed
     */
    function _vote(
        address member,
        bool vote,
        uint256 proposalID,
        bool doRevert
    ) private returns (bool) {
        Proposal storage proposal = proposals[proposalID];
        if (doRevert) {
            require(members[member], "Not a member, cannot vote");
            require(proposals[proposalID].id != 0, "Invalid proposalID");
            require(
                proposalStatus(proposalID) == ProposalStates.VOTING,
                "Not in voting stage"
            );
            require(
                proposal.votes[member] == VoteStatus.NOT_VOTED,
                "Already voted"
            );
        } else {
            if (
                !members[msg.sender] ||
                proposals[proposalID].id == 0 ||
                proposalStatus(proposalID) != ProposalStates.VOTING ||
                proposal.votes[member] != VoteStatus.NOT_VOTED
            ) {
                return false;
            }
        }

        if (vote) {
            proposal.voteYes++;
            proposal.votes[member] = VoteStatus.VOTED_YES;
        } else {
            proposal.voteNo++;
            proposal.votes[member] = VoteStatus.VOTED_NO;
        }

        emit Vote(proposalID, member, vote);
        return true;
    }
}
