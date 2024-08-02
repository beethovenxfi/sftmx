// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./interfaces/ISFC.sol";
import "./Vault.sol";
import "./FTMStaking.sol";

contract VaultUnlocker {
    FTMStaking public immutable _staking;
    Vault public immutable _vault;
    address public immutable _treasury = 0xa1E849B1d6c2Fd31c63EEf7822e9E0632411ada7;

    constructor(FTMStaking ftmStaking, Vault vault) {
        _staking = ftmStaking;
        _vault = vault;
    }

    function unlockVault() external {
        require(msg.sender == _treasury, "ERR_UNAUTHORIZED_CALLER");
        require(_vault.owner() == address(this), "ERR_UNAUTHORIZED");

        // Need to store to calculate the diff
        uint256 totalFtmBefore = _staking.totalFTMWorth();
        uint256 rateBefore = _staking.getExchangeRate();

        // unlocking the vault, this will pay the penalty and not the complete stake will be returned
        uint256 currentStake = _vault.currentStakeValue();
        _vault.unlock(currentStake);

        // calculate the penalty
        uint256 totalFtmAfter = _staking.totalFTMWorth();
        uint256 penalty = totalFtmBefore - totalFtmAfter;
        require(penalty < address(this).balance, "ERR_INSUFFICIENT_FUNDS");

        // send FTM to the vault to make up for penalty
        address stakingAddress = address(_staking);
        (bool sentToStaking, bytes memory dataStaking) = stakingAddress.call{value: penalty}("");
        require(sentToStaking, "Failed to send FTM to staking");

        require(_staking.totalFTMWorth() == totalFtmBefore, "ERR_FTMWORTH_CHANGED");
        require(_staking.getExchangeRate() == rateBefore, "ERR_RATE_CHANGED");

        // revert the ownership back to the staking contract
        _vault.updateOwner(stakingAddress);

        // send any excess FTM back
        uint256 balance = address(this).balance;
        (bool sentTotreasry, bytes memory dataTreasury) = _treasury.call{value: balance}("");
        require(sentTotreasry, "Failed to send FTM to treasury");
    }

    function revertOwnership() external {
        require(msg.sender == _treasury, "ERR_UNAUTHORIZED_CALLER");
        require(_vault.owner() == address(this), "ERR_UNAUTHORIZED");
        _vault.updateOwner(address(_staking));
    }

    function retrieveFtm() external {
        require(msg.sender == _treasury, "ERR_UNAUTHORIZED_CALLER");
        // send any excess FTM back
        uint256 balance = address(this).balance;
        (bool sentTotreasry, bytes memory dataTreasury) = _treasury.call{value: balance}("");
        require(sentTotreasry, "Failed to send FTM to treasury");
    }

    receive() external payable {}
}
