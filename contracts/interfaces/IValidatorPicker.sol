// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IValidatorPicker {
    function getNextValidatorInfo(uint256 amount)
        external
        returns (uint256 toValidatorID, uint256 lockupDuration);
}
