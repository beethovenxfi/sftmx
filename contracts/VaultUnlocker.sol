// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./interfaces/ISFC.sol";
import "./Vault.sol";
import "./FTMStaking.sol";

contract VaultUnlocker {
    FTMStaking public immutable _staking = FTMStaking(payable(address(0xB458BfC855ab504a8a327720FcEF98886065529b)));
    address public immutable _treasury = 0xa1E849B1d6c2Fd31c63EEf7822e9E0632411ada7;

    constructor() {}

    function unlockVault(Vault vault) external {
        require(msg.sender == _treasury, "ERR_UNAUTHORIZED_CALLER");
        require(vault.owner() == address(this), "ERR_UNAUTHORIZED");

        // Need to store to calculate the diff
        uint256 totalFtmBefore = _staking.totalFTMWorth();
        uint256 rateBefore = _staking.getExchangeRate();

        // unlocking the vault, this will pay the penalty and not the complete stake will be returned
        uint256 currentStake = vault.currentStakeValue();
        vault.unlock(currentStake);

        // calculate the penalty
        uint256 totalFtmAfter = _staking.totalFTMWorth();
        uint256 penalty = totalFtmBefore - totalFtmAfter;
        require(penalty < address(this).balance, "ERR_INSUFFICIENT_FUNDS_FOR_PENALTY");

        // send FTM to the vault to make up for penalty
        address stakingAddress = address(_staking);
        (bool sentToStaking, bytes memory dataStaking) = stakingAddress.call{value: penalty}("");
        require(sentToStaking, "Failed to send FTM to staking");

        require(_staking.totalFTMWorth() == totalFtmBefore, "ERR_FTMWORTH_CHANGED");
        require(_staking.getExchangeRate() == rateBefore, "ERR_RATE_CHANGED");

        // revert the ownership back to the staking contract
        vault.updateOwner(stakingAddress);
    }

    // backup function to change the owner back to the staking contract
    function revertOwnership(Vault vault) external {
        require(msg.sender == _treasury, "ERR_UNAUTHORIZED_CALLER");
        require(vault.owner() == address(this), "ERR_UNAUTHORIZED");
        vault.updateOwner(address(_staking));
    }

    // send any excess FTM back to treasury
    function retrieveFtm() external {
        require(msg.sender == _treasury, "ERR_UNAUTHORIZED_CALLER");
        // send any excess FTM back
        uint256 balance = address(this).balance;
        (bool sentTotreasry, bytes memory dataTreasury) = _treasury.call{value: balance}("");
        require(sentTotreasry, "Failed to send FTM to treasury");
    }

    receive() external payable {}
}
