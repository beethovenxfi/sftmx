// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./interfaces/ISFC.sol";
import "./Vault.sol";
import "./FTMStaking.sol";

contract VaultUnlocker {
    FTMStaking public immutable _staking;
    Vault public immutable _vault;
    address public immutable _treasury;

    constructor(FTMStaking ftmStaking, Vault vault, address treasury) {
        _staking = ftmStaking;
        _vault = vault;
        _treasury = treasury;
    }

    function unlockVault() external payable {
        require(_vault.owner() == address(this), "ERR_UNAUTHORIZED");

        // Need to store to calculate the diff
        uint256 totalFtmBefore = _staking.totalFTMWorth();

        // unlocking the vault, this will pay the penalty and not the complete stake will be returned
        uint256 currentStake = _vault.currentStakeValue();
        _vault.unlock(currentStake);

        // calculate the penalty
        uint256 totalFtmAfter = _staking.totalFTMWorth();
        uint256 penalty = totalFtmBefore - totalFtmAfter;
        require(penalty <= msg.value, "ERR_INSUFFICIENT_FUNDS");

        // send FTM to the vault to make up for penalty
        address stakingAddress = address(_staking);
        (bool sentToStaking, bytes memory dataStaking) = stakingAddress.call{value: penalty}("");
        require(sentToStaking, "Failed to send FTM to staking");

        // revert the ownership back to the staking contract
        _vault.updateOwner(stakingAddress);

        // send any excess FTM back
        uint256 balance = address(this).balance;
        (bool sentTotreasry, bytes memory dataTreasury) = _treasury.call{value: balance}("");
        require(sentTotreasry, "Failed to send FTM to treasury");
    }

    receive() external payable {}
}
