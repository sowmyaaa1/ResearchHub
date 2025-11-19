// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IHederaTokenService.sol";
import "./libs/HederaTokenService.sol";
import "./libs/SafeOperations.sol";

/**
 * @title ResearchHubCore
 * @dev Core contract for decentralized scientific publishing and peer review
 * Handles paper submission, review assignment, staking, and rewards
 */
contract ResearchHubCore {
    using SafeOperations for uint256;

    // Events
    event PaperSubmitted(uint256 indexed paperId, address indexed author, string ipfsCid, uint256 submissionFee);
    event ReviewerAssigned(uint256 indexed paperId, address indexed reviewer, uint256 stakeAmount);
    event ReviewClaimed(uint256 indexed paperId, address indexed reviewer, uint256 deadline);
    event ReviewSubmitted(uint256 indexed paperId, address indexed reviewer, string reviewIpfsCid, uint8 verdict);
    event ConsensusReached(uint256 indexed paperId, bool approved, uint256 rewardPool);
    event ReputationUpdated(address indexed user, int256 change, uint256 newReputation);
    event StakeSlashed(address indexed reviewer, uint256 amount, uint256 paperId);
    event RewardsDistributed(uint256 indexed paperId, address[] reviewers, uint256[] amounts);

    // Structs
    struct Paper {
        uint256 id;
        address author;
        string ipfsCid;          // IPFS hash for paper content
        uint256 submissionFee;   // Fee paid by author
        uint64 submissionTime;
        PaperStatus status;
        uint8 requiredReviews;   // Number of reviews needed
        uint8 completedReviews;  // Number of reviews submitted
        uint256 rewardPool;      // Total rewards available
        bool consensusReached;
        bool approved;           // Final consensus decision
    }

    struct Review {
        address reviewer;
        uint256 paperId;
        string ipfsCid;          // IPFS hash for review content
        uint8 verdict;           // 1=accept, 2=minor revision, 3=major revision, 4=reject
        uint256 stakeAmount;
        uint64 submissionTime;
        bool rewarded;
        bool slashed;
    }

    struct Reviewer {
        uint256 reputation;
        uint256 totalStaked;
        uint256 availableBalance;
        string[] expertiseTags;
        uint64 lastActive;
        bool isActive;
    }

    enum PaperStatus {
        Submitted,
        UnderReview,
        ReviewComplete,
        Published,
        Rejected
    }

    // State variables
    mapping(uint256 => Paper) public papers;
    mapping(uint256 => Review[]) public paperReviews;
    mapping(address => Reviewer) public reviewers;
    mapping(uint256 => mapping(address => bool)) public hasReviewed;
    mapping(uint256 => address[]) public paperReviewers;
    
    uint256 public nextPaperId;
    uint256 public submissionFeeBase = 10 * 10**8; // 10 HBAR in tinybars
    uint256 public stakeRequirement = 5 * 10**8;   // 5 HBAR minimum stake
    uint256 public reviewReward = 3 * 10**8;       // 3 HBAR per quality review
    uint256 public consensusThreshold = 67;        // 67% threshold for consensus
    
    address public paperToken;  // HTS token for rewards
    address public owner;
    bool public paused;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier validPaper(uint256 _paperId) {
        require(_paperId < nextPaperId && papers[_paperId].id == _paperId, "Invalid paper ID");
        _;
    }

    constructor(address _paperToken) {
        owner = msg.sender;
        paperToken = _paperToken;
        nextPaperId = 1;
    }

    /**
     * @dev Submit a new paper for peer review
     * @param _ipfsCid IPFS hash of the paper content
     * @param _requiredReviews Number of reviews required (default: 3)
     */
    function submitPaper(
        string calldata _ipfsCid,
        uint8 _requiredReviews
    ) external payable notPaused {
        require(bytes(_ipfsCid).length > 0, "Invalid IPFS CID");
        require(_requiredReviews >= 1 && _requiredReviews <= 10, "Invalid review count");
        require(msg.value >= submissionFeeBase, "Insufficient submission fee");

        uint256 paperId = nextPaperId++;
        uint256 rewardPool = (msg.value * 80) / 100; // 80% goes to reward pool

        papers[paperId] = Paper({
            id: paperId,
            author: msg.sender,
            ipfsCid: _ipfsCid,
            submissionFee: msg.value,
            submissionTime: uint64(block.timestamp),
            status: PaperStatus.Submitted,
            requiredReviews: _requiredReviews,
            completedReviews: 0,
            rewardPool: rewardPool,
            consensusReached: false,
            approved: false
        });

        emit PaperSubmitted(paperId, msg.sender, _ipfsCid, msg.value);
    }

    /**
     * @dev Register as a reviewer with expertise tags
     * @param _expertiseTags Array of expertise area tags
     */
    function registerReviewer(string[] calldata _expertiseTags) external {
        require(_expertiseTags.length > 0, "Must provide expertise tags");
        
        Reviewer storage reviewer = reviewers[msg.sender];
        reviewer.expertiseTags = _expertiseTags;
        reviewer.isActive = true;
        reviewer.lastActive = uint64(block.timestamp);
        
        if (reviewer.reputation == 0) {
            reviewer.reputation = 100; // Starting reputation
        }
    }

    /**
     * @dev Claim a review assignment and stake tokens
     * @param _paperId Paper to review
     */
    function claimReview(uint256 _paperId) external payable validPaper(_paperId) notPaused {
        Paper storage paper = papers[_paperId];
        require(paper.status == PaperStatus.Submitted || paper.status == PaperStatus.UnderReview, "Paper not available for review");
        require(paper.author != msg.sender, "Cannot review own paper");
        require(!hasReviewed[_paperId][msg.sender], "Already reviewing this paper");
        require(paperReviews[_paperId].length < paper.requiredReviews, "All review slots filled");
        require(msg.value >= stakeRequirement, "Insufficient stake amount");
        require(reviewers[msg.sender].isActive, "Not registered as reviewer");

        // Update reviewer stake
        reviewers[msg.sender].totalStaked += msg.value;
        hasReviewed[_paperId][msg.sender] = true;
        paperReviewers[_paperId].push(msg.sender);

        // Create review entry
        paperReviews[_paperId].push(Review({
            reviewer: msg.sender,
            paperId: _paperId,
            ipfsCid: "",
            verdict: 0,
            stakeAmount: msg.value,
            submissionTime: 0,
            rewarded: false,
            slashed: false
        }));

        // Update paper status
        if (paper.status == PaperStatus.Submitted) {
            paper.status = PaperStatus.UnderReview;
        }

        uint256 deadline = block.timestamp + 14 days; // 2 weeks to complete review
        emit ReviewClaimed(_paperId, msg.sender, deadline);
    }

    /**
     * @dev Submit a review for a paper
     * @param _paperId Paper being reviewed
     * @param _reviewIpfsCid IPFS hash of review content
     * @param _verdict Review verdict (1-4)
     */
    function submitReview(
        uint256 _paperId,
        string calldata _reviewIpfsCid,
        uint8 _verdict
    ) external validPaper(_paperId) notPaused {
        require(bytes(_reviewIpfsCid).length > 0, "Invalid review IPFS CID");
        require(_verdict >= 1 && _verdict <= 4, "Invalid verdict");
        require(hasReviewed[_paperId][msg.sender], "Not assigned to review this paper");

        Paper storage paper = papers[_paperId];
        require(paper.status == PaperStatus.UnderReview, "Paper not under review");

        // Find and update the review
        Review[] storage reviews = paperReviews[_paperId];
        bool found = false;
        for (uint i = 0; i < reviews.length; i++) {
            if (reviews[i].reviewer == msg.sender && reviews[i].submissionTime == 0) {
                reviews[i].ipfsCid = _reviewIpfsCid;
                reviews[i].verdict = _verdict;
                reviews[i].submissionTime = uint64(block.timestamp);
                found = true;
                break;
            }
        }
        require(found, "Review assignment not found");

        paper.completedReviews++;
        
        // Update reviewer activity
        reviewers[msg.sender].lastActive = uint64(block.timestamp);

        emit ReviewSubmitted(_paperId, msg.sender, _reviewIpfsCid, _verdict);

        // Check if consensus can be reached
        if (paper.completedReviews >= paper.requiredReviews) {
            _evaluateConsensus(_paperId);
        }
    }

    /**
     * @dev Internal function to evaluate consensus and distribute rewards
     */
    function _evaluateConsensus(uint256 _paperId) internal {
        Paper storage paper = papers[_paperId];
        Review[] storage reviews = paperReviews[_paperId];
        
        require(reviews.length >= paper.requiredReviews, "Not enough reviews");

        // Calculate weighted consensus based on reviewer reputation
        uint256 totalWeight = 0;
        uint256 approvalWeight = 0;
        
        for (uint i = 0; i < reviews.length; i++) {
            if (reviews[i].submissionTime > 0) { // Review was submitted
                uint256 weight = reviewers[reviews[i].reviewer].reputation;
                totalWeight += weight;
                
                // Verdicts 1-2 count as approval, 3-4 as rejection
                if (reviews[i].verdict <= 2) {
                    approvalWeight += weight;
                }
            }
        }

        // Calculate consensus percentage
        uint256 approvalPercentage = (approvalWeight * 100) / totalWeight;
        bool approved = approvalPercentage >= consensusThreshold;
        
        paper.approved = approved;
        paper.consensusReached = true;
        paper.status = approved ? PaperStatus.Published : PaperStatus.Rejected;

        emit ConsensusReached(_paperId, approved, paper.rewardPool);

        // Distribute rewards and update reputation
        _distributeRewards(_paperId, approved);
    }

    /**
     * @dev Distribute rewards to reviewers based on consensus alignment
     */
    function _distributeRewards(uint256 _paperId, bool paperApproved) internal {
        Paper storage paper = papers[_paperId];
        Review[] storage reviews = paperReviews[_paperId];
        
        address[] memory rewardRecipients = new address[](reviews.length);
        uint256[] memory rewardAmounts = new uint256[](reviews.length);
        uint256 totalRewardsDistributed = 0;

        for (uint i = 0; i < reviews.length; i++) {
            Review storage review = reviews[i];
            
            if (review.submissionTime > 0) { // Review was submitted
                bool reviewApproved = review.verdict <= 2;
                bool alignedWithConsensus = (reviewApproved == paperApproved);
                
                if (alignedWithConsensus) {
                    // Reward aligned reviewers
                    uint256 reward = reviewReward;
                    review.rewarded = true;
                    
                    // Return stake + reward
                    uint256 totalPayment = review.stakeAmount + reward;
                    reviewers[review.reviewer].totalStaked -= review.stakeAmount;
                    reviewers[review.reviewer].availableBalance += totalPayment;
                    
                    // Increase reputation
                    reviewers[review.reviewer].reputation += 10;
                    emit ReputationUpdated(review.reviewer, 10, reviewers[review.reviewer].reputation);
                    
                    rewardRecipients[i] = review.reviewer;
                    rewardAmounts[i] = reward;
                    totalRewardsDistributed += reward;
                    
                } else {
                    // Slash stake of misaligned reviewers
                    uint256 slashAmount = review.stakeAmount / 2; // 50% slash
                    review.slashed = true;
                    
                    reviewers[review.reviewer].totalStaked -= review.stakeAmount;
                    reviewers[review.reviewer].availableBalance += (review.stakeAmount - slashAmount);
                    
                    // Decrease reputation
                    uint256 reputationLoss = reviewers[review.reviewer].reputation > 20 ? 20 : reviewers[review.reviewer].reputation / 2;
                    reviewers[review.reviewer].reputation -= reputationLoss;
                    emit ReputationUpdated(review.reviewer, -int256(reputationLoss), reviewers[review.reviewer].reputation);
                    emit StakeSlashed(review.reviewer, slashAmount, _paperId);
                }
            }
        }

        emit RewardsDistributed(_paperId, rewardRecipients, rewardAmounts);
    }

    /**
     * @dev Withdraw available balance
     */
    function withdrawBalance() external {
        uint256 balance = reviewers[msg.sender].availableBalance;
        require(balance > 0, "No balance to withdraw");
        
        reviewers[msg.sender].availableBalance = 0;
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Emergency functions for contract management
     */
    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function updateFees(
        uint256 _submissionFee,
        uint256 _stakeRequirement,
        uint256 _reviewReward
    ) external onlyOwner {
        submissionFeeBase = _submissionFee;
        stakeRequirement = _stakeRequirement;
        reviewReward = _reviewReward;
    }

    // View functions
    function getPaper(uint256 _paperId) external view returns (Paper memory) {
        return papers[_paperId];
    }

    function getReviews(uint256 _paperId) external view returns (Review[] memory) {
        return paperReviews[_paperId];
    }

    function getReviewer(address _reviewer) external view returns (Reviewer memory) {
        return reviewers[_reviewer];
    }

    function getReviewerExpertise(address _reviewer) external view returns (string[] memory) {
        return reviewers[_reviewer].expertiseTags;
    }

    function getPaperReviewers(uint256 _paperId) external view returns (address[] memory) {
        return paperReviewers[_paperId];
    }
}