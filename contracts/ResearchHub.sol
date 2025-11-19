// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ResearchHub {
    struct Paper {
        uint256 id;
        string title;
        address author;
        bool published;
    }

    struct Review {
        uint256 id;
        uint256 paperId;
        address reviewer;
        bool recorded;
    }

    struct Assignment {
        uint256 paperId;
        address reviewer;
        bool claimed;
        uint256 dueDate;
    }

    event PaperPublished(uint256 indexed id, string title, address indexed author);
    event ReviewRecorded(uint256 indexed id, uint256 indexed paperId, address indexed reviewer);
    event ReviewClaimed(uint256 indexed paperId, address indexed reviewer, uint256 dueDate);

    mapping(uint256 => Paper) public papers;
    mapping(uint256 => Review) public reviews;
    mapping(bytes32 => Assignment) public assignments;

function publishPaper(uint256 id, string calldata title) external payable {
    require(msg.value == 10 ether, "Must send exactly 10 HBAR");
    require(!papers[id].published, "Already published");
    papers[id] = Paper(id, title, msg.sender, true);
    emit PaperPublished(id, title, msg.sender);
}

    function recordReview(uint256 id, uint256 paperId) external {
        require(papers[paperId].published, "Paper not published");
        require(!reviews[id].recorded, "Review already recorded");
        reviews[id] = Review(id, paperId, msg.sender, true);
        emit ReviewRecorded(id, paperId, msg.sender);
    }

    function claimReview(uint256 paperId, uint256 dueDate) external {
        bytes32 key = keccak256(abi.encodePacked(paperId, msg.sender));
        require(!assignments[key].claimed, "Already claimed");
        assignments[key] = Assignment(paperId, msg.sender, true, dueDate);
        emit ReviewClaimed(paperId, msg.sender, dueDate);
    }
}
