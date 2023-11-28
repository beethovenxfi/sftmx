// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Validator Picker Contract
 * @author Stader Labs
 * @notice This contract is responsible to pick the next validator
 * for the staking contract to stake with
 */
contract ValidatorPicker is Ownable {
    uint256 private _toValidatorID;
    uint256 private _lockupDuration;

    constructor() {}

    /**
     * @notice Returns the ID, and lock duration for the next validator
     * @param amount the amount of FTM to lock
     */
    function getNextValidatorInfo(uint256 amount)
        external
        view
        returns (uint256, uint256)
    {
        return (_toValidatorID, _lockupDuration);
    }

    /**
     * @notice Sets the information for the next validator (onlyOwner)
     * @param toValidatorID the ID of the validator
     * @param lockupDuration the duration for which to lock
     */
    function setNextValidatorInfo(uint256 toValidatorID, uint256 lockupDuration)
        external
        onlyOwner
    {
        _toValidatorID = toValidatorID;
        _lockupDuration = lockupDuration;
    }
}
