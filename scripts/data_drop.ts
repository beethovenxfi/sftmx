// @ts-ignore
import { ethers } from 'hardhat'
import { BigNumber } from 'ethers/lib/ethers'
import FTMStaking from '../artifacts/contracts/FTMStaking.sol/FTMStaking.json'
import Vault from '../artifacts/contracts/Vault.sol/Vault.json'
import ValidatorPicker from '../artifacts/contracts/ValidatorPicker.sol/ValidatorPicker.json'

async function main() {
    const SFC = '0xFC00FACE00000000000000000000000000000000'
    const VALIDATOR_PICKER = '0xb09101eC9B3EC745129aC8e9c8a45F90B23c483C'
    const FTM_STAKING_PROXY = '0xB458BfC855ab504a8a327720FcEF98886065529b'

    const maxLockApr = 0.06

    const baseApr = 0.06 * 0.3

    const picker = await ethers.getContractAt(ValidatorPicker.abi, VALIDATOR_PICKER)

    const validatorInfo = await picker.getNextValidatorInfo('10000000000000000')
    const validatorOwner = await picker.owner()

    console.log(`next validator id: ${validatorInfo[0]}`)
    console.log(`next validator lockup duration: ${validatorInfo[1]}`)
    console.log(`validatorpicker owner: ${validatorOwner}`)

    const ftmStaking = await ethers.getContractAt(FTMStaking.abi, FTM_STAKING_PROXY)
    const maxVaultCount = await ftmStaking.maxVaultCount()
    console.log(maxVaultCount.toString())

    let totalStaked = BigNumber.from('0')

    for (let i = 0; i < maxVaultCount; i++) {
        const vaultAddress = await ftmStaking.getVault(i)
        if (vaultAddress !== '0x0000000000000000000000000000000000000000') {
            const vault = await ethers.getContractAt(Vault.abi, vaultAddress)
            const stakedAmount = await vault.currentStakeValue()
            const validatorId = await vault.toValidatorID()
            const owner = await vault.owner()
            console.log(`Vault ID ${i} at addr ${vaultAddress} has ${stakedAmount} staked`)
            console.log(`Vault ID ${vaultAddress} delegated to validator ${validatorId}`)
            // console.log(`Vault ID ${vaultId} has owner ${owner}`)
            totalStaked = totalStaked.add(stakedAmount)
        }
    }

    // for(const vaultId of vaultIds){
    //     const vaultAddress = await ftmStaking.getVault(vaultId);
    //     const vault = await ethers.getContractAt(Vault.abi, vaultAddress);
    //     const stakedAmount = await vault.currentStakeValue();
    //     const validatorId = await vault.toValidatorID()
    //     const owner = await vault.owner()
    //     console.log(`Vault ID ${vaultId} at addr ${vaultAddress} has ${stakedAmount} staked`)
    //     // console.log(`Vault ID ${vaultId} delegated to validator ${validatorId}`)
    //     // console.log(`Vault ID ${vaultId} has owner ${owner}`)
    //     totalStaked = totalStaked.add(stakedAmount);
    // }

    console.log(`Total staked amount is ${totalStaked} or ${ethers.utils.formatUnits(totalStaked, 18)} FTM`)

    const maturedVaultCount = await ftmStaking.getMaturedVaultLength()
    let totalMatured = BigNumber.from('0')

    for (let i = 0; i < maturedVaultCount; i++) {
        const vaultAddress = await ftmStaking.getMaturedVault(i)
        if (vaultAddress !== '0x0000000000000000000000000000000000000000') {
            const vault = await ethers.getContractAt(Vault.abi, vaultAddress)
            const stakedAmount = await vault.currentStakeValue()
            const validatorId = await vault.toValidatorID()
            const owner = await vault.owner()
            console.log(`Vault ID ${i} at addr ${vaultAddress} has ${stakedAmount} staked`)
            // console.log(`Vault ID ${vaultId} delegated to validator ${validatorId}`)
            // console.log(`Vault ID ${vaultId} has owner ${owner}`)
            totalMatured = totalMatured.add(stakedAmount)
        }
    }

    // for(const maturedVaultId of maturedVaults){
    //     const vaultAddress = await ftmStaking.getMaturedVault(maturedVaultId);
    //     const vault = await ethers.getContractAt(Vault.abi, vaultAddress);
    //     const stakedAmount = await vault.currentStakeValue();
    //     const validatorId = await vault.toValidatorID()
    //     const owner = await vault.owner()
    //     console.log(`Vault ID ${maturedVaultId} at addr ${vaultAddress} has ${stakedAmount} staked`)
    //     // console.log(`Vault ID ${maturedVaultId} delegated to validator ${validatorId}`)
    //     // console.log(`Vault ID ${maturedVaultId} has owner ${owner}`)
    //     totalMatured = totalStaked.add(stakedAmount);
    // }

    console.log(`Total matured staked amount is ${totalMatured} or ${ethers.utils.formatUnits(totalMatured, 18)} FTM`)

    const ftmPoolAmount = await ftmStaking.getPoolBalance()
    console.log(`FTM pool balance is  ${ftmPoolAmount} or ${ethers.utils.formatUnits(ftmPoolAmount, 18)} FTM`)

    const totalFTM = totalStaked.add(totalMatured).add(ftmPoolAmount)
    console.log(`Total calculated ${totalFTM} or ${ethers.utils.formatUnits(totalFTM, 18)} FTM`)

    // const totalFtmWorth = await ftmStaking.totalFTMWorth();
    // console.log(`Total from staking contract  ${totalFtmWorth} or ${ethers.utils.formatUnits(totalFtmWorth, 18)} FTM`)

    const stakedPercentage = parseFloat(totalStaked.toString()) / parseFloat(totalFTM.toString())
    const maturedPercentage = parseFloat(totalMatured.toString()) / parseFloat(totalFTM.toString())
    const poolPercentage = parseFloat(ftmPoolAmount.toString()) / parseFloat(totalFTM.toString())

    console.log(`stakedPercentage: ${stakedPercentage}`)
    console.log(`maturedPercentage: ${maturedPercentage}`)
    console.log(`poolPercentage: ${poolPercentage}`)

    // const aprBase6 = (stakedPercentage * maxLockApr + maturedPercentage * baseApr) / 3
    // const aprBase5 = (stakedPercentage * maxLockApr * 0.85 + maturedPercentage * baseApr) / 3

    // console.log(`aprBase6: ${aprBase6}`)
    // console.log(`aprBase5: ${aprBase5}`)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
