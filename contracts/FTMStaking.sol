// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./interfaces/ISFC.sol";
import "./interfaces/IERC20Burnable.sol";
import "./interfaces/IValidatorPicker.sol";

import "./Vault.sol";

import "./libraries/SFCPenalty.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title FTM Staking Contract
 * @author Stader Labs
 * @notice Main point of interaction with Stader protocol's v1 liquid staking
 */
contract FTMStakingV1_1 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // These constants have been taken from the SFC contract
    uint256 public constant DECIMAL_UNIT = 1e18;
    uint256 public constant UNLOCKED_REWARD_RATIO = (30 * DECIMAL_UNIT) / 100;
    uint256 public constant MAX_LOCKUP_DURATION = 86400 * 365;

    struct UndelegateInfo {
        address payable vault;
        uint256 amountToUnlock;
        uint256 amountToUndelegate;
    }

    struct WithdrawalRequest {
        UndelegateInfo[] info;
        uint256 requestTime;
        uint256 poolAmount;
        uint256 undelegateAmount;
        uint256 penalty;
        address user;
        bool isWithdrawn;
    }

    /**
     * @dev A reference to the FTMX ERC20 token contract
     */
    IERC20Burnable public FTMX;

    /**
     * @dev A reference to the SFC contract
     */
    ISFC public SFC;

    /**
     * @dev A reference to the Validator picker contract
     */
    IValidatorPicker public validatorPicker;

    /**
     * @dev A reference to the treasury address
     */
    address public treasury;

    /**
     * @dev The protocol fee in basis points (BIPS)
     */
    uint256 public protocolFeeBIPS;

    /**
     * @dev The last known epoch to prevent wasting gas during reward claim process
     */
    uint256 public lastKnownEpoch;

    /**
     * @dev The maximum number of vaults that can be created
     */
    uint256 public maxVaultCount;

    /**
     * The duration of an epoch between two successive locks
     */
    uint256 public epochDuration;

    /**
     * The delay between undelegation & withdrawal
     */
    uint256 public withdrawalDelay;

    uint256 public minDeposit;

    uint256 public maxDeposit;

    bool public undelegatePaused;

    bool public withdrawPaused;

    bool public maintenancePaused;

    /**
     * The index of the next vault to be created
     */
    uint256 public currentVaultPtr;

    /**
     * The count of vaults in existence
     */
    uint256 public currentVaultCount;

    /**
     * The next timestamp eligible for locking
     */
    uint256 public nextEligibleTimestamp;

    /**
     * The currently pending FTM withdrawal amount
     */
    uint256 public ftmPendingWithdrawal;

    address payable[] private _maturedVaults;

    mapping(uint256 => address payable) private _allVaults;

    mapping(uint256 => WithdrawalRequest) public allWithdrawalRequests;

    // All storage above this comment belongs to the V1 contract

    /**
     * @dev A reference to the locker admin address
     */
    address public lockerAdmin;

    // Events

    event LogValidatorPickerSet(address indexed owner, address validatorPicker);
    event LogEpochDurationSet(address indexed owner, uint256 duration);
    event LogWithdrawalDelaySet(address indexed owner, uint256 delay);
    event LogUndelegatePausedUpdated(address indexed owner, bool newValue);
    event LogWithdrawPausedUpdated(address indexed owner, bool newValue);
    event LogMaintenancePausedUpdated(address indexed owner, bool newValue);
    event LogDepositLimitUpdated(address indexed owner, uint256 low, uint256 high);

    event LogVaultOwnerUpdated(address indexed owner, address vault, address newOwner);
    event LogDeposited(address indexed user, uint256 amount, uint256 ftmxAmount);
    event LogUndelegated(address indexed user, uint256 wrID, uint256 amountFTMx);
    event LogWithdrawn(address indexed user, uint256 wrID, uint256 totalAmount, uint256 bitmaskToSkip);
    event LogLocked(address indexed vault, uint256 lockupDuration, uint256 amount);
    event LogVaultHarvested(address indexed vault, uint256 maturedIndex);
    event LogVaultWithdrawn(address indexed vault);

    // Events in v1_1

    event LogTreasuryUpdated(address indexed owner, address newTreasury);
    event LogProtocolFeeUpdated(address indexed owner, uint256 newFeeBIPS);
    event LogLockerAdminUpdated(address indexed owner, address newAdmin);
    event VaultDeleted(uint256 indexed vaultIndex, address indexed vaultAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /*******************************
     * Getter & helper functions   *
     *******************************/

    /**
     * @notice Returns the vault address at the requested index
     * @param vaultIndex the index to query
     */
    function getVault(uint256 vaultIndex) external view returns (address) {
        return _allVaults[vaultIndex];
    }

    /**
     * @notice Returns the length of matured vaults pending withdrawal
     */
    function getMaturedVaultLength() external view returns (uint256) {
        return _maturedVaults.length;
    }

    /**
     * @notice Returns the matured vault address at the requested index
     * @param vaultIndex the index to query
     */
    function getMaturedVault(uint256 vaultIndex) external view returns (address payable) {
        return _maturedVaults[vaultIndex];
    }

    /**
     * @notice Returns the list of vaults, associated amounts for the given withdrawal ID
     * @param wrID the withdrawal ID to query
     */
    function getWithdrawalInfo(uint256 wrID) external view returns (UndelegateInfo[] memory) {
        return allWithdrawalRequests[wrID].info;
    }

    /**
     * @notice Returns the currently available FTM balance to delegate
     */
    function getPoolBalance() public view returns (uint256) {
        return address(this).balance - ftmPendingWithdrawal;
    }

    /**
     * @notice Returns the current FTM worth of the protocol
     *
     * Considers:
     *  - current stake value for all vaults (including bonded slashing)
     *  - contract's poolBalance
     */
    function totalFTMWorth() public view returns (uint256) {
        uint256 total = getPoolBalance();
        uint256 vaultCount = maxVaultCount;
        for (uint256 i = 0; i < vaultCount; i = _uncheckedInc(i)) {
            address payable vault = _allVaults[i];
            if (vault != address(0)) {
                total += _currentStakeValue(vault);
            }
        }

        uint256 maturedCount = _maturedVaults.length;
        for (uint256 i = 0; i < maturedCount; i = _uncheckedInc(i)) {
            address payable vault = _maturedVaults[i];
            total += _currentStakeValue(vault);
        }

        return total;
    }

    /**
     * @notice Returns the amount of FTM equivalent 1 FTMX (with 18 decimals)
     */
    function getExchangeRate() public view returns (uint256) {
        uint256 totalFTM = totalFTMWorth();
        uint256 totalFTMx = FTMX.totalSupply();

        if (totalFTM == 0 || totalFTMx == 0) {
            return 1 * DECIMAL_UNIT;
        }
        return (totalFTM * DECIMAL_UNIT) / totalFTMx;
    }

    /**
     * @notice Returns the amount of FTMX equivalent to the provided FTM
     * @param ftmAmount the amount of FTM
     * @param toIgnore flag to ignore input ftmAmount from calculations (must be true for deposits)
     */
    function getFTMxAmountForFTM(uint256 ftmAmount, bool toIgnore) public view returns (uint256) {
        uint256 totalFTM = totalFTMWorth();
        uint256 totalFTMx = FTMX.totalSupply();

        if (toIgnore) {
            require(totalFTM >= ftmAmount, "ERR_TOTALFTM_IS_NOT_ENOUGH");
            totalFTM -= ftmAmount;
        }

        if (totalFTM == 0 || totalFTMx == 0) {
            return ftmAmount;
        }
        return (ftmAmount * totalFTMx) / totalFTM;
    }

    /**
     * @notice Returns the penalty to be charged on undelegating the given amount of FTMx
     * @param amountFTMx the amount of FTMx to undelegate
     * @return amount the amount of FTM the input is worth
     * @return amountToUndelegate the amount of FTM coming from the vaults
     * @return penalty the total penalty (in FTM) applicable on undelegation
     */
    function calculatePenalty(uint256 amountFTMx) public view returns (uint256, uint256, uint256) {
        uint256 amount = (amountFTMx * getExchangeRate()) / DECIMAL_UNIT;
        uint256 poolBalance = getPoolBalance();

        if (amount <= poolBalance) {
            // no penalty
            return (amount, 0, 0);
        }

        uint256 totalStake;
        uint256 totalPenalty;
        uint256 vaultCount = maxVaultCount;
        for (uint256 i = 0; i < vaultCount; i = _uncheckedInc(i)) {
            address payable vault = _allVaults[i];
            if (vault != address(0)) {
                uint256 toValidatorID = Vault(vault).toValidatorID();
                totalStake += SFC.getStake(vault, toValidatorID);
                if (SFC.isLockedUp(vault, toValidatorID)) {
                    uint256 vaultLockedAmount = Vault(vault).getLockedStake();
                    totalPenalty += SFCPenalty.getUnlockPenalty(SFC, vault, toValidatorID, vaultLockedAmount, vaultLockedAmount);
                }
            }
        }
        uint256 amountToUndelegate = amount - poolBalance;
        uint256 penalty = (amountToUndelegate * totalPenalty) / totalStake;
        return (amount, amountToUndelegate, penalty);
    }

    /**
     * @notice Returns the info of vaults from which to undelegate
     * @param amount the amount to undelegate
     * @return info the struct of type UndelegateInfo, denoting undelegation info of vaults
     * @return implicitPenalty the implicit penalty paid by this undelegation in unlocking
     */
    function pickVaultsToUndelegate(uint256 amount) public view returns (UndelegateInfo[] memory, uint256) {
        uint256 maxCount = maxVaultCount;

        UndelegateInfo[] memory infoTemp = new UndelegateInfo[](maxCount);

        uint256 vaultPtr = currentVaultPtr;
        uint256 index;
        uint256 implicitPenalty;

        while (amount > 0) {
            vaultPtr = _decrementWithMod(vaultPtr, maxCount);
            address payable vault = _allVaults[vaultPtr];

            if (vault == address(0)) {
                // Should not happen if amount is less than current FTM worth
                break;
            }

            (uint256 amountToUnlock, uint256 amountToUndelegate, uint256 amountToReduce) = _getAmountsAfterPenalty(vault, amount);

            infoTemp[index].vault = vault;
            infoTemp[index].amountToUnlock = amountToUnlock;
            infoTemp[index].amountToUndelegate = amountToUndelegate;
            implicitPenalty += amountToUnlock - amountToUndelegate;

            amount -= amountToReduce;
            index += 1;
        }

        UndelegateInfo[] memory info = new UndelegateInfo[](index);

        for (uint256 i = 0; i < index; i = _uncheckedInc(i)) {
            info[i] = infoTemp[i];
        }

        return (info, implicitPenalty);
    }

    /**********************
     * Admin functions   *
     **********************/

    /**
     * @notice Delegate the current pool balance with the next available validator
     * @param amount the amount to lock
     * IMPORTANT: the validator is picked by the validator picker contract
     */
    function lock(uint256 amount) external {
        require(msg.sender == lockerAdmin, "ERR_UNAUTHORIZED");
        require(_now() >= nextEligibleTimestamp, "ERR_WAIT_FOR_NEXT_EPOCH");

        uint256 poolBalance = getPoolBalance();
        if (amount > poolBalance) {
            amount = poolBalance;
        }

        nextEligibleTimestamp = _now() + epochDuration;

        (uint256 toValidatorID, uint256 lockupDuration) = validatorPicker.getNextValidatorInfo(amount);

        address payable newVault = _createVault(toValidatorID);
        _lockVault(newVault, lockupDuration, amount);

        emit LogLocked(newVault, lockupDuration, amount);
    }

    /**
     * @notice Set validator picker contract address (onlyOwner)
     * @param picker the new picker contract address
     */
    function setValidatorPicker(IValidatorPicker picker) external onlyOwner {
        validatorPicker = picker;
        emit LogValidatorPickerSet(msg.sender, address(picker));
    }

    /**
     * @notice Set epoch duration (onlyOwner)
     * @param duration the new epoch duration
     */
    function setEpochDuration(uint256 duration) external onlyOwner {
        epochDuration = duration;
        emit LogEpochDurationSet(msg.sender, duration);
    }

    /**
     * @notice Set withdrawal delay (onlyOwner)
     * @param delay the new delay
     */
    function setWithdrawalDelay(uint256 delay) external onlyOwner {
        withdrawalDelay = delay;
        emit LogWithdrawalDelaySet(msg.sender, delay);
    }

    /**
     * @notice Set the owner of an arbitrary input vault (onlyOwner)
     * @param vault the vault address
     * @param newOwner the new owner address
     */
    function updateVaultOwner(address payable vault, address newOwner) external onlyOwner {
        // Needs to support arbitrary input address to work with expired/matured vaults
        require(newOwner != address(0), "ERR_INVALID_VALUE");
        Vault(vault).updateOwner(newOwner);
        emit LogVaultOwnerUpdated(msg.sender, vault, newOwner);
    }

    /**
     * @notice Pause/unpause user undelegations (onlyOwner)
     * @param desiredValue the desired value of the switch
     */
    function setUndelegatePaused(bool desiredValue) external onlyOwner {
        require(undelegatePaused != desiredValue, "ERR_ALREADY_DESIRED_VALUE");
        undelegatePaused = desiredValue;
        emit LogUndelegatePausedUpdated(msg.sender, desiredValue);
    }

    /**
     * @notice Pause/unpause user withdrawals (onlyOwner)
     * @param desiredValue the desired value of the switch
     */
    function setWithdrawPaused(bool desiredValue) external onlyOwner {
        require(withdrawPaused != desiredValue, "ERR_ALREADY_DESIRED_VALUE");
        withdrawPaused = desiredValue;
        emit LogWithdrawPausedUpdated(msg.sender, desiredValue);
    }

    /**
     * @notice Pause/unpause maintenance functions (onlyOwner)
     * @param desiredValue the desired value of the switch
     */
    function setMaintenancePaused(bool desiredValue) external onlyOwner {
        require(maintenancePaused != desiredValue, "ERR_ALREADY_DESIRED_VALUE");
        maintenancePaused = desiredValue;
        emit LogMaintenancePausedUpdated(msg.sender, desiredValue);
    }

    function setDepositLimits(uint256 low, uint256 high) external onlyOwner {
        minDeposit = low;
        maxDeposit = high;
        emit LogDepositLimitUpdated(msg.sender, low, high);
    }

    /**
     * @notice Update the treasury address
     * @param newTreasury the new treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "ERR_INVALID_VALUE");
        treasury = newTreasury;
        emit LogTreasuryUpdated(msg.sender, newTreasury);
    }

    /**
     * @notice Update the protocol fee
     * @param newFeeBIPS the value of the fee (in BIPS)
     */
    function setProtocolFeeBIPS(uint256 newFeeBIPS) external onlyOwner {
        require(newFeeBIPS <= 10_000, "ERR_INVALID_VALUE");
        protocolFeeBIPS = newFeeBIPS;
        emit LogProtocolFeeUpdated(msg.sender, newFeeBIPS);
    }

    /**
     * @notice Update the locker admin address
     * @param newLockerAdmin the new locker admin address
     */
    function setLockerAdmin(address newLockerAdmin) external onlyOwner {
        require(newLockerAdmin != address(0), "ERR_INVALID_VALUE");
        lockerAdmin = newLockerAdmin;
        emit LogLockerAdminUpdated(msg.sender, newLockerAdmin);
    }

    /**********************
     * End User Functions *
     **********************/

    /**
     * @notice Deposit FTM, and mint FTMX
     */
    function deposit() external payable {
        uint256 amount = msg.value;
        require(amount >= minDeposit && amount <= maxDeposit, "ERR_AMOUNT_OUTSIDE_LIMITS");

        uint256 ftmxAmount = getFTMxAmountForFTM(amount, true);
        FTMX.mint(msg.sender, ftmxAmount);

        emit LogDeposited(msg.sender, msg.value, ftmxAmount);
    }

    /**
     * @notice Undelegate FTMx, corresponding FTM can then be withdrawn after `withdrawalDelay`
     * @param wrID a unique withdrawal ID
     * @param amountFTMx the amount of FTMx to undelegate
     * @param minAmountFTM the minimum amount of FTM to receive
     *
     * Requirements:
     *  - wrID must not be used before
     *  - wrID must be greater than 0
     */
    function undelegate(uint256 wrID, uint256 amountFTMx, uint256 minAmountFTM) external {
        require(!undelegatePaused, "ERR_UNDELEGATE_IS_PAUSED");

        _undelegate(msg.sender, wrID, amountFTMx, minAmountFTM);

        emit LogUndelegated(msg.sender, wrID, amountFTMx);
    }

    /**
     * @notice Withdraw undelegated FTM
     * @param wrID the unique wrID for the undelegation request
     * @param bitmaskToSkip a bit-mask to denote which vault to skip (if any)
     *
     * Requirements:
     *  - must wait for `withdrawalDelay` between undelegation and withdrawal
     *
     * IMPORTANT : bitmaskToSkip must be 0 if no vault is to be skipped. It is useful
     * in scenarios where a particular validator was slashed (and not refunded), so we
     * want to withdraw from all expect the slashed validator.
     * A validator once skipped cannot be withdrawn from again, even if they are refunded.
     *
     * Using the bitmask
     * Consider vaults in the allWithdrawalRequests to be numbered as 1,2,3...
     * To skip vault i, bitmask (Bi) = 2^(i-1)
     * To skip vault i and j, bitmask = Bi | Bj
     *      where | is the bitwise OR operation
     */
    function withdraw(uint256 wrID, uint256 bitmaskToSkip) external {
        require(!withdrawPaused, "ERR_WITHDRAW_IS_PAUSED");

        WithdrawalRequest storage request = allWithdrawalRequests[wrID];

        require(request.requestTime > 0, "ERR_WRID_INVALID");
        require(_now() >= request.requestTime + withdrawalDelay, "ERR_NOT_ENOUGH_TIME_PASSED");
        require(!request.isWithdrawn, "ERR_ALREADY_WITHDRAWN");
        request.isWithdrawn = true;

        address user = request.user;
        require(msg.sender == user, "ERR_UNAUTHORIZED");

        uint256 totalAmount = request.poolAmount;

        if (totalAmount > 0) {
            _reduceFromPendingWithdrawal(totalAmount);
        }

        if (request.undelegateAmount > 0) {
            uint256 actualAmountUndelegated;
            uint256 vaultCount = request.info.length;
            uint256 bitPos = 1;
            uint256 balanceBefore = address(this).balance;

            for (uint256 i = 0; i < vaultCount; i = _uncheckedInc(i)) {
                if ((bitmaskToSkip & bitPos) != bitPos) {
                    // Note: If the validator is slashed, the below call fails, in turn failing the entire txn
                    // Thus, use the bitmask to skip this validator
                    _withdrawVault(request.info[i].vault, wrID, false);
                    actualAmountUndelegated += request.info[i].amountToUndelegate;
                }
                bitPos *= 2;
            }

            totalAmount += address(this).balance - balanceBefore - (request.penalty * actualAmountUndelegated) / request.undelegateAmount;
        }

        // protection against deleting the withdrawal request and going back empty handed
        require(totalAmount > 0, "ERR_FULLY_SLASHED");

        // do transfer after marking as withdrawn to protect against re-entrancy
        payable(user).transfer(totalAmount);

        emit LogWithdrawn(user, wrID, totalAmount, bitmaskToSkip);
    }

    /*************************
     * Maintenance Functions *
     *************************/

    /**
     * @notice Claim rewards from all contracts and add them to the pool
     */
    function claimRewardsAll() external {
        require(!maintenancePaused, "ERR_THIS_FUNCTION_IS_PAUSED");

        uint256 currentEpoch = SFC.currentEpoch();

        if (currentEpoch <= lastKnownEpoch) {
            return;
        }

        lastKnownEpoch = currentEpoch;

        uint256 balanceBefore = address(this).balance;

        uint256 vaultCount = maxVaultCount;
        for (uint256 i = 0; i < vaultCount; i = _uncheckedInc(i)) {
            address payable vault = _allVaults[i];
            if (vault != address(0)) {
                _claim(vault);
            }
        }

        if (protocolFeeBIPS > 0) {
            uint256 balanceAfter = address(this).balance;
            uint256 protocolFee = ((balanceAfter - balanceBefore) * protocolFeeBIPS) / 10_000;

            (bool sent, ) = treasury.call{value: protocolFee}("");
            require(sent, "ERR_FAILED_TO_SEND_PROTOCOL_FEE");
        }
    }

    /**
     * @notice Harvest matured amount from a given vault
     * @param vaultIndex the index of the vault to harvest
     */
    function harvestVault(uint256 vaultIndex) external {
        require(!maintenancePaused, "ERR_THIS_FUNCTION_IS_PAUSED");

        address payable vault = _allVaults[vaultIndex];
        require(vault != address(0), "ERR_INVALID_INDEX");

        uint256 toValidatorID = Vault(vault).toValidatorID();
        require(!SFC.isLockedUp(vault, toValidatorID), "ERR_NOT_UNLOCKED_YET");

        // We reserve wrID of 0 for undelegating on maturity
        Vault(vault).undelegate(0, SFC.getStake(vault, toValidatorID));
        _claim(vault);

        // store info for withdrawal
        _maturedVaults.push(vault);

        // the vault is now empty
        delete _allVaults[vaultIndex];
        _decrementVaultCount();

        emit LogVaultHarvested(vault, _maturedVaults.length - 1);
    }

    /**
     * @notice Withdraw harvested amount from a given vault and add them to the pool
     * @param maturedIndex the index of the vault (in list of matured vaults) to withdraw
     */
    function withdrawMatured(uint256 maturedIndex) external {
        require(!maintenancePaused, "ERR_THIS_FUNCTION_IS_PAUSED");

        address payable vault = _maturedVaults[maturedIndex];
        require(vault != address(0), "ERR_INVALID_INDEX");
        _maturedVaults[maturedIndex] = _maturedVaults[_maturedVaults.length - 1];
        _maturedVaults.pop();
        _withdrawVault(vault, 0, true);

        emit LogVaultWithdrawn(vault);
    }

    /**********************
     * Internal functions *
     **********************/

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _currentStakeValue(address payable vault) internal view returns (uint256) {
        uint256 toValidatorID = Vault(vault).toValidatorID();
        uint256 stake = SFC.getStake(vault, toValidatorID);
        uint256 rewardsAll = SFC.pendingRewards(vault, toValidatorID);
        uint256 rewardsReal = rewardsAll - (rewardsAll * protocolFeeBIPS) / 10_000;
        (, , uint256 matured) = SFC.getWithdrawalRequest(vault, toValidatorID, 0);
        uint256 penalty;
        bool isSlashed = SFC.isSlashed(toValidatorID);
        if (isSlashed) {
            penalty = _getSlashingPenalty(stake + matured, SFC.slashingRefundRatio(toValidatorID));
        }
        return stake + rewardsReal + matured - penalty;
    }

    function _getSlashingPenalty(uint256 amount, uint256 refundRatio) internal pure returns (uint256) {
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

    function _createVault(uint256 toValidatorID) internal returns (address payable) {
        require(currentVaultCount < maxVaultCount, "ERR_MAX_VAULTS_OCCUPIED");
        address payable vault = payable(address(new Vault(SFC, toValidatorID)));
        _allVaults[currentVaultPtr] = vault;
        _incrementVaultPtr();
        _incrementVaultCount();
        return vault;
    }

    function _lockVault(address payable vault, uint256 lockupDuration, uint256 amount) internal {
        Vault(vault).delegate{value: amount}();
        Vault(vault).lockStake(lockupDuration, amount);
    }

    function _claim(address payable vault) internal returns (bool) {
        try Vault(vault).claimRewards() {} catch {
            return false;
        }
        return true;
    }

    function _undelegate(address user, uint256 wrID, uint256 amountFTMx, uint256 minAmountFTM) internal {
        require(amountFTMx > 0, "ERR_ZERO_AMOUNT");
        require(wrID > 0, "ERR_wrID_MUST_BE_NON_ZERO");

        WithdrawalRequest storage request = allWithdrawalRequests[wrID];
        require(request.requestTime == 0, "ERR_WRID_ALREADY_USED");

        request.requestTime = _now();
        request.user = user;

        (uint256 amount, uint256 totalAmountToUndelegate, uint256 penalty) = calculatePenalty(amountFTMx);
        require(amount - penalty >= minAmountFTM, "ERR_INSUFFICIENT_AMOUNT_OUT");

        FTMX.burnFrom(user, amountFTMx);

        if (totalAmountToUndelegate == 0) {
            // no penalty, all from pool
            _addToPendingWithdrawal(amount);
            request.poolAmount = amount;
        } else {
            // use whatever is in pool, undelegate the remaining
            _addToPendingWithdrawal(amount - totalAmountToUndelegate);

            (UndelegateInfo[] memory info, uint256 implicitPenalty) = pickVaultsToUndelegate(totalAmountToUndelegate);

            uint256 vaultCount = info.length;
            uint256 maxCount = maxVaultCount;
            uint256 vaultPtr = currentVaultPtr;

            for (uint256 i = 0; i < vaultCount; i = _uncheckedInc(i)) {
                _unlockAndUndelegateVault(info[i].vault, wrID, info[i].amountToUnlock, info[i].amountToUndelegate);

                if (i < vaultCount - 1 || ((i == vaultCount - 1) && Vault(info[i].vault).getLockedStake() == 0)) {
                    // the vault is empty
                    vaultPtr = _decrementWithMod(vaultPtr, maxCount);
                    emit VaultDeleted(vaultPtr, _allVaults[vaultPtr]);
                    delete _allVaults[vaultPtr];

                    _decrementVaultPtr();
                    _decrementVaultCount();
                }
                request.info.push(UndelegateInfo(info[i].vault, info[i].amountToUnlock, info[i].amountToUndelegate));
            }

            request.poolAmount = amount - totalAmountToUndelegate;
            request.undelegateAmount = totalAmountToUndelegate;
            if (implicitPenalty > penalty) {
                implicitPenalty = penalty;
            }
            request.penalty = penalty - implicitPenalty;
        }
    }

    function _unlockAndUndelegateVault(address payable vault, uint256 wrID, uint256 amountToUnlock, uint256 amountToUndelegate) internal {
        Vault(vault).unlock(amountToUnlock);
        Vault(vault).undelegate(wrID, amountToUndelegate);
    }

    function _withdrawVault(address payable vault, uint256 wrID, bool withdrawAll) internal {
        Vault(vault).withdraw(wrID, withdrawAll);
    }

    function _addToPendingWithdrawal(uint256 amount) internal {
        ftmPendingWithdrawal += amount;
    }

    function _reduceFromPendingWithdrawal(uint256 amount) internal {
        ftmPendingWithdrawal -= amount;
    }

    function _incrementVaultPtr() internal {
        uint256 candidatePtr = _incrementWithMod(currentVaultPtr, maxVaultCount);
        while (_allVaults[candidatePtr] != address(0)) {
            candidatePtr = _incrementWithMod(currentVaultPtr, maxVaultCount);
        }
        currentVaultPtr = candidatePtr;
    }

    function _decrementVaultPtr() internal {
        currentVaultPtr = _decrementWithMod(currentVaultPtr, maxVaultCount);
    }

    function _incrementVaultCount() internal {
        unchecked {
            currentVaultCount += 1;
        }
    }

    function _decrementVaultCount() internal {
        unchecked {
            currentVaultCount -= 1;
        }
    }

    function _now() internal view returns (uint256) {
        return block.timestamp;
    }

    function _incrementWithMod(uint256 i, uint256 mod) internal pure returns (uint256) {
        return (i + 1) % mod;
    }

    function _decrementWithMod(uint256 i, uint256 mod) internal pure returns (uint256) {
        return (i + mod - 1) % mod;
    }

    function _uncheckedInc(uint256 i) internal pure returns (uint256) {
        unchecked {
            return i + 1;
        }
    }

    /************************
     *   Helper function    *
     *        for           *
     * Penalty Calculation  *
     ************************/

    function _getAmountsAfterPenalty(address payable vault, uint256 amount) internal view returns (uint256, uint256, uint256) {
        uint256 toValidatorID = Vault(vault).toValidatorID();
        uint256 vaultLockedAmount = Vault(vault).getLockedStake();
        uint256 amountUndelegatable = vaultLockedAmount -
            SFCPenalty.getUnlockPenalty(SFC, vault, toValidatorID, vaultLockedAmount, vaultLockedAmount);

        if (amountUndelegatable > amount) {
            // amount undelegatable is more than amount needed, so we do a partial unlock
            uint256 estimatedToUnlock = (amount * vaultLockedAmount) / amountUndelegatable;
            uint256 estimatedPenalty = SFCPenalty.getUnlockPenalty(SFC, vault, toValidatorID, estimatedToUnlock, vaultLockedAmount);
            return (estimatedToUnlock, estimatedToUnlock - estimatedPenalty, amount);
        }
        return (vaultLockedAmount, amountUndelegatable, amountUndelegatable);
    }

    /**
     * @notice To receive Eth from vaults
     */
    receive() external payable {}
}
