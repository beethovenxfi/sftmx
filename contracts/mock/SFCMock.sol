// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/ISFC.sol";

contract SFCMock is ISFC {
    struct Validator {
        uint256 status;
        uint256 deactivatedTime;
        uint256 deactivatedEpoch;
        uint256 receivedStake;
        uint256 createdEpoch;
        uint256 createdTime;
        address auth;
    }

    struct EpochSnapshot {
        mapping(uint256 => uint256) receivedStake;
        mapping(uint256 => uint256) accumulatedRewardPerToken;
        mapping(uint256 => uint256) accumulatedUptime;
        mapping(uint256 => uint256) accumulatedOriginatedTxsFee;
        mapping(uint256 => uint256) offlineTime;
        mapping(uint256 => uint256) offlineBlocks;
        uint256[] validatorIDs;
        uint256 endTime;
        uint256 epochFee;
        uint256 totalBaseRewardWeight;
        uint256 totalTxRewardWeight;
        uint256 baseRewardPerSecond;
        uint256 totalStake;
        uint256 totalSupply;
    }

    struct LockedDelegation {
        uint256 lockedStake;
        uint256 fromEpoch;
        uint256 endTime;
        uint256 duration;
    }

    struct Rewards {
        uint256 lockupExtraReward;
        uint256 lockupBaseReward;
        uint256 unlockedReward;
    }

    uint256 private _currentEpoch;
    uint256 private _currentSealedEpoch;

    mapping(uint256 => uint256) private _pendingWithdrawal;

    mapping(uint256 => Validator) public override getValidator;
    mapping(uint256 => EpochSnapshot) public override getEpochSnapshot;
    mapping(address => mapping(uint256 => uint256)) public override getStake;
    mapping(address => mapping(uint256 => Rewards)) public override getStashedLockupRewards;
    mapping(address => mapping(uint256 => LockedDelegation)) public override getLockupInfo;

    mapping(address => mapping(uint256 => uint256)) public _pendingRewards;
    mapping(address => mapping(uint256 => bool)) public _isLockedUp;
    mapping(address => mapping(uint256 => uint256)) public _stashedRewardsUntilEpoch;

    mapping(uint256 => mapping(uint256 => uint256)) public epochAccumulatedRewardPerToken;

    mapping(uint256 => uint256) public _slashingRefundRatio;
    mapping(uint256 => bool) public _isSlashed;

    function getWithdrawalRequest(address, uint256, uint256 wrID) external view override returns (uint256, uint256, uint256) {
        return (0, 0, _pendingWithdrawal[wrID]);
    }

    function currentEpoch() external view override returns (uint256) {
        return _currentEpoch;
    }

    function setCurrentEpoch(uint256 __currentEpoch) external {
        _currentEpoch = __currentEpoch;
    }

    function currentSealedEpoch() external view override returns (uint256) {
        return _currentSealedEpoch;
    }

    function setCurrentSealedEpoch(uint256 __currentSealedEpoch) external {
        _currentSealedEpoch = __currentSealedEpoch;
    }

    function setValidator(
        uint256 toValidatorID,
        uint256,
        uint256 status,
        uint256 deactivatedTime,
        uint256 deactivatedEpoch,
        uint256 receivedStake,
        uint256 createdEpoch,
        uint256 createdTime,
        address auth
    ) external {
        getValidator[toValidatorID] = Validator(status, deactivatedTime, deactivatedEpoch, receivedStake, createdEpoch, createdTime, auth);
    }

    function setEpochSnapshot(
        uint256 epoch,
        uint256 endTime,
        uint256 epochFee,
        uint256 totalBaseRewardWeight,
        uint256 totalTxRewardWeight,
        uint256 baseRewardPerSecond,
        uint256 totalStake,
        uint256 totalSupply
    ) external {
        getEpochSnapshot[epoch].endTime = endTime;
        getEpochSnapshot[epoch].epochFee = epochFee;
        getEpochSnapshot[epoch].totalBaseRewardWeight = totalBaseRewardWeight;
        getEpochSnapshot[epoch].totalTxRewardWeight = totalTxRewardWeight;
        getEpochSnapshot[epoch].baseRewardPerSecond = baseRewardPerSecond;
        getEpochSnapshot[epoch].totalStake = totalStake;
        getEpochSnapshot[epoch].totalSupply = totalSupply;
    }

    function setLockupInfo(
        address delegator,
        uint256 toValidatorID,
        uint256 lockedStake,
        uint256 fromEpoch,
        uint256 endTime,
        uint256 duration
    ) external {
        getLockupInfo[delegator][toValidatorID].lockedStake = lockedStake;
        getLockupInfo[delegator][toValidatorID].fromEpoch = fromEpoch;
        getLockupInfo[delegator][toValidatorID].endTime = endTime;
        getLockupInfo[delegator][toValidatorID].duration = duration;
    }

    function setStake(address delegator, uint256 toValidatorID, uint256 stake) public {
        getStake[delegator][toValidatorID] = stake;
    }

    function setStashedLockupRewards(
        address delegator,
        uint256 toValidatorID,
        uint256 lockupExtraReward,
        uint256 lockupBaseReward,
        uint256 unlockedReward
    ) external {
        getStashedLockupRewards[delegator][toValidatorID].lockupExtraReward = lockupExtraReward;
        getStashedLockupRewards[delegator][toValidatorID].lockupBaseReward = lockupBaseReward;
        getStashedLockupRewards[delegator][toValidatorID].unlockedReward = unlockedReward;
    }

    function setLockedStake(address delegator, uint256 toValidatorID, uint256 lockedStake) public {
        getLockupInfo[delegator][toValidatorID].lockedStake = lockedStake;
    }

    function getLockedStake(address delegator, uint256 toValidatorID) external view override returns (uint256) {
        return getLockupInfo[delegator][toValidatorID].lockedStake;
    }

    function setPendingRewards(address delegator, uint256 toValidatorID, uint256 rewards) external payable {
        require(msg.value == rewards, "Insufficient funds sent");
        _pendingRewards[delegator][toValidatorID] = rewards;
    }

    function pendingRewards(address delegator, uint256 toValidatorID) external view override returns (uint256) {
        return _pendingRewards[delegator][toValidatorID];
    }

    function setIsSlashed(uint256 toValidatorID, bool __isSlashed) external {
        _isSlashed[toValidatorID] = __isSlashed;
    }

    function isSlashed(uint256 toValidatorID) external view override returns (bool) {
        return _isSlashed[toValidatorID];
    }

    function setSlashingRefundRatio(uint256 toValidatorID, uint256 ratio) external {
        _slashingRefundRatio[toValidatorID] = ratio;
    }

    function slashingRefundRatio(uint256 toValidatorID) external view override returns (uint256) {
        return _slashingRefundRatio[toValidatorID];
    }

    function setEpochAccumulatedRewardPerToken(uint256 epoch, uint256 validatorID, uint256 reward) external {
        epochAccumulatedRewardPerToken[epoch][validatorID] = reward;
    }

    function getEpochAccumulatedRewardPerToken(uint256 epoch, uint256 validatorID) external view override returns (uint256) {
        return epochAccumulatedRewardPerToken[epoch][validatorID];
    }

    function setStashedRewardsUntilEpoch(address delegator, uint256 toValidatorID, uint256 stashedRewards) external {
        _stashedRewardsUntilEpoch[delegator][toValidatorID] = stashedRewards;
    }

    function stashedRewardsUntilEpoch(address delegator, uint256 toValidatorID) external view override returns (uint256) {
        return _stashedRewardsUntilEpoch[delegator][toValidatorID];
    }

    function setIsLockedUp(address delegator, uint256 toValidatorID, bool __isLockedUp) external {
        _isLockedUp[delegator][toValidatorID] = __isLockedUp;
    }

    function isLockedUp(address delegator, uint256 toValidatorID) external view override returns (bool) {
        return _isLockedUp[delegator][toValidatorID];
    }

    function delegate(uint256 toValidatorID) external payable override {
        setStake(msg.sender, toValidatorID, msg.value);
    }

    function lockStake(uint256 toValidatorID, uint256, uint256 amount) external override {
        setLockedStake(msg.sender, toValidatorID, amount);
    }

    function relockStake(uint256 toValidatorID, uint256, uint256 amount) external override {
        setLockedStake(msg.sender, toValidatorID, amount);
    }

    function restakeRewards(uint256 toValidatorID) external override {
        uint256 rewards = _pendingRewards[msg.sender][toValidatorID];
        _pendingRewards[msg.sender][toValidatorID] = 0;
        getLockupInfo[msg.sender][toValidatorID].lockedStake += rewards;
    }

    function claimRewards(uint256 toValidatorID) external override {
        uint256 rewards = _pendingRewards[msg.sender][toValidatorID];
        _pendingRewards[msg.sender][toValidatorID] = 0;
        payable(msg.sender).transfer(rewards);
    }

    function undelegate(uint256 toValidatorID, uint256 wrID, uint256 amount) external override {
        getStake[msg.sender][toValidatorID] -= amount;
        _pendingWithdrawal[wrID] = amount;
    }

    function unlockStake(uint256 toValidatorID, uint256 amount) external override returns (uint256) {
        getLockupInfo[msg.sender][toValidatorID].lockedStake -= amount;
        return 0;
    }

    function withdraw(uint256 toValidatorID, uint256 wrID) external override {
        uint256 amount = _pendingWithdrawal[wrID];
        _pendingWithdrawal[wrID] = 0;
        payable(msg.sender).transfer(amount);
    }
}
