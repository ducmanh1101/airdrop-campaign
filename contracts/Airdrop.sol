// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title MerkleAirdrop
 * @dev Contract for distributing ERC20 tokens via Merkle Tree airdrop campaigns
 */
contract Airdrop is Ownable, ReentrancyGuard {
    uint256 internal constant PRECISION = 1e6;
    using SafeERC20 for IERC20;

    struct Campaign {
        address token; // Token to be airdropped
        bytes32 merkleRoot; // Merkle root for verification
        uint256 totalAllocated; // Total amount deposited for this campaign
        uint256 totalClaimed; // Amount already claimed
        uint256 feeRate; // Campaign fee rate
        uint256 endTime; // Campaign end time
        string name; // Campaign name
    }

    // Mapping from campaign ID to campaign details
    mapping(uint256 => Campaign) public campaigns;

    // Mapping from campaign ID => user address => claimed status
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // Campaign counter
    uint256 public campaignCounter;

    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed token,
        bytes32 merkleRoot,
        uint256 totalAllocated,
        uint256 endTime,
        string name
    );

    event TokensClaimed(uint256 indexed campaignId, address indexed claimer, uint256 amount);

    event CampaignClosed(uint256 indexed campaignId, uint256 remainingAmount);

    constructor(address _owner) Ownable(_owner) {}

    /**
     * @dev Create a new airdrop campaign
     * @param _token Address of the ERC20 token to airdrop
     * @param _merkleRoot Merkle root for the airdrop recipients
     * @param _totalAllocated Total amount of tokens to deposit
     * @param _feeRate Fee rate for the campaign (in percentage, e.g., 0.01 = 1%)
     * @param _duration Duration of the campaign in seconds
     * @param _name Name of the campaign
     */
    function createCampaign(
        address _token,
        bytes32 _merkleRoot,
        uint256 _totalAllocated,
        uint256 _feeRate,
        uint256 _duration,
        string memory _name
    ) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_merkleRoot != bytes32(0), "Invalid merkle root");
        require(_totalAllocated > 0, "Total amount must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        require(bytes(_name).length > 0, "Campaign name cannot be empty");

        uint256 campaignId = campaignCounter++;
        uint256 endTime = block.timestamp + _duration;

        campaigns[campaignId] = Campaign({
            token: _token,
            merkleRoot: _merkleRoot,
            totalAllocated: _totalAllocated,
            totalClaimed: 0,
            feeRate: _feeRate,
            endTime: endTime,
            name: _name
        });

        // Transfer tokens from admin to contract
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _totalAllocated);

        emit CampaignCreated(campaignId, _token, _merkleRoot, _totalAllocated, endTime, _name);
    }

    /**
     * @dev Claim tokens from a specific campaign
     * @param _campaignId ID of the campaign
     * @param _amount Amount of tokens to claim
     * @param _proof Merkle proof for verification
     */
    function claim(uint256 _campaignId, uint256 _amount, bytes32[] calldata _proof) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];

        require(block.timestamp <= campaign.endTime, "Campaign has ended");
        require(!hasClaimed[_campaignId][msg.sender], "Already claimed");
        require(_amount > 0, "Amount must be greater than 0");

        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(MerkleProof.verify(_proof, campaign.merkleRoot, leaf), "Invalid proof");

        uint256 feeAmount = (_amount * campaign.feeRate) / PRECISION;
        uint256 netAmount = _amount - feeAmount;

        hasClaimed[_campaignId][msg.sender] = true;
        campaign.totalClaimed += netAmount;

        IERC20(campaign.token).safeTransfer(msg.sender, netAmount);

        emit TokensClaimed(_campaignId, msg.sender, netAmount);
    }

    /**
     * @dev Close a campaign and withdraw remaining tokens (only after expiry)
     * @param _campaignId ID of the campaign to close
     */
    function closeCampaign(uint256 _campaignId) external onlyOwner {
        Campaign storage campaign = campaigns[_campaignId];

        require(block.timestamp > campaign.endTime, "Campaign has not ended yet");

        uint256 remainingAmount = campaign.totalAllocated - campaign.totalClaimed;

        if (remainingAmount > 0) {
            IERC20(campaign.token).safeTransfer(owner(), remainingAmount);
        }

        emit CampaignClosed(_campaignId, remainingAmount);
    }

    /**
     * @dev Update campaign merkle root (only before start time)
     * @param _campaignId ID of the campaign
     * @param _newMerkleRoot New merkle root
     */
    function updateMerkleRoot(uint256 _campaignId, bytes32 _newMerkleRoot) external onlyOwner {
        Campaign storage campaign = campaigns[_campaignId];

        require(campaign.totalClaimed == 0, "Already has claims");
        require(_newMerkleRoot != bytes32(0), "Invalid merkle root");

        campaign.merkleRoot = _newMerkleRoot;
    }

    /**
     * @dev Extend campaign duration
     * @param _campaignId ID of the campaign
     * @param _additionalDuration Additional time in seconds
     */
    function extendCampaign(uint256 _campaignId, uint256 _additionalDuration) external onlyOwner {
        Campaign storage campaign = campaigns[_campaignId];

        require(_additionalDuration > 0, "Additional duration must be greater than 0");

        campaign.endTime += _additionalDuration;
    }

    /**
     * @dev Get all campaigns
     */
    function getCampaigns() external view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](campaignCounter);
        for (uint256 i = 0; i < campaignCounter; i++) {
            allCampaigns[i] = campaigns[i];
        }
        return allCampaigns;
    }

    /**
     * @dev Get campaign details
     * @param _campaignId ID of the campaign
     */
    function getCampaign(uint256 _campaignId) external view returns (Campaign memory campaign) {
        return campaigns[_campaignId];
    }

    /**
     * @dev Check if a user has claimed from a campaign
     * @param _campaignId ID of the campaign
     * @param _user Address of the user
     */
    function hasUserClaimed(uint256 _campaignId, address _user) external view returns (bool) {
        return hasClaimed[_campaignId][_user];
    }
}
