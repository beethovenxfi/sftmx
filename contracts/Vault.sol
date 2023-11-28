// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./interfaces/ISFC.sol";

/**
 * @title Vault Contract
 * @author Stader Labs
 * @notice Vault contract is created by the Main Staking contract everytime FTM is delegated to a validator
 */
contract Vault {
    uint256 public constant DECIMAL_UNIT = 1e18;
    string public constant VERSION = "v1";

    ISFC public immutable SFC;
    address public owner;
    address public immutable toValidator;
    uint256 public immutable toValidatorID;

    /**
     * @notice Constructor
     * @param _sfc the address of the SFC contract
     * @param _toValidatorID the ID of the validator, as stored in the SFC contract
     */
    constructor(ISFC _sfc, uint256 _toValidatorID) {
        owner = msg.sender;
        SFC = _sfc;
        toValidatorID = _toValidatorID;

        (, , , , , , address auth) = _sfc.getValidator(_toValidatorID);

        toValidator = auth;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ERR_UNAUTHORIZED");
        _;
    }

    /**
     * @notice Returns the current value of the staked FTM, including rewards and slashing (if any)
     */
    function currentStakeValue() external view returns (uint256) {
        uint256 stake = SFC.getStake(address(this), toValidatorID);
        uint256 rewards = SFC.pendingRewards(address(this), toValidatorID);
        (, , uint256 matured) = SFC.getWithdrawalRequest(address(this), toValidatorID, 0);
        uint256 penalty;
        bool isSlashed = SFC.isSlashed(toValidatorID);
        if (isSlashed) {
            penalty = _getSlashingPenalty(stake + matured);
        }
        return stake + rewards + matured - penalty;
    }

    /**
     * @notice Returns the amount of FTM locked via this vault
     */
    function getLockedStake() external view returns (uint256) {
        return SFC.getLockedStake(address(this), toValidatorID);
    }

    /**
     * @notice Delegate FTM to the validator
     */
    function delegate() external payable onlyOwner {
        SFC.delegate{value: msg.value}(toValidatorID);
    }

    /**
     * @notice Lock the delegated stake
     * @param lockupDuration the duration for which to lock the stake
     * @param amount the amount of stake to lock
     */
    function lockStake(uint256 lockupDuration, uint256 amount) external onlyOwner {
        SFC.lockStake(toValidatorID, lockupDuration, amount);
    }

    /**
     * @notice Claim all rewards accrued so far
     */
    function claimRewards() external onlyOwner {
        SFC.claimRewards(toValidatorID);
        payable(owner).transfer(address(this).balance);
    }

    /**
     * @notice Unlock the locked stake
     * @param amount the amount of stake to unlock
     *
     * Assumption:
     *  - is locked up
     */
    function unlock(uint256 amount) external onlyOwner {
        SFC.unlockStake(toValidatorID, amount);
    }

    /**
     * @notice Undelegate the unlocked stake
     * @param wrID a unique withdrawal ID
     * @param amount the amount of stake to undelegate
     *
     * Assumption:
     *  - amount <= unlocked balance
     */
    function undelegate(uint256 wrID, uint256 amount) external onlyOwner {
        SFC.undelegate(toValidatorID, wrID, amount);
    }

    /**
     * @notice Withdraw the undelegated stake
     * @param wrID the withdrawal ID for the withdrawal request
     * @param sendAll bool to determine whether to send entire contract balance to owner
     *
     * Assumption:
     *  -  enough time has passed after the undelegation
     *  -  stake is NOT slashed
     */
    function withdraw(uint256 wrID, bool sendAll) external onlyOwner {
        uint256 initialBal = address(this).balance;
        SFC.withdraw(toValidatorID, wrID);
        uint256 toSend = address(this).balance;
        if (!sendAll) {
            toSend -= initialBal;
        }
        payable(owner).transfer(toSend);
    }

    /**
     * @notice Relock the unlocked stake
     * @param lockupDuration the duration for which to lock the stake
     * @param amount the amount of stake to relock
     */
    function relockStake(uint256 lockupDuration, uint256 amount) external onlyOwner {
        SFC.relockStake(toValidatorID, lockupDuration, amount);
    }

    /**
     * @notice Restake the accrued rewards
     */
    function restakeRewards() external onlyOwner {
        SFC.restakeRewards(toValidatorID);
    }

    /**
     * @notice Update the owner of the vault
     * @param newOwner the new owner of the vault
     */
    function updateOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ERR_INVALID_VALUE");
        owner = newOwner;
    }

    function _getSlashingPenalty(uint256 amount) internal view returns (uint256) {
        uint256 refundRatio = SFC.slashingRefundRatio(toValidatorID);
        if (refundRatio >= DECIMAL_UNIT) {
            return 0;
        }
        // round penalty upwards (ceiling) to prevent dust amount attacks
        uint256 penalty = ((amount * (DECIMAL_UNIT - refundRatio)) / DECIMAL_UNIT) + 1;
        if (penalty > amount) {
            return amount;
        }
        return penalty;
    }

    /**
     * @notice To receive Eth from SFC
     */
    receive() external payable {}
}
