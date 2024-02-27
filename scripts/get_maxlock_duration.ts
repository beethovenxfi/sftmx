// @ts-ignore
import { ethers } from 'hardhat'
import { BigNumber } from 'ethers/lib/ethers'
import FTMStaking from '../artifacts/contracts/FTMStaking.sol/FTMStaking.json'
import SFCContract from '../artifacts/contracts/interfaces/ISFC.sol/ISFC.json'
import Vault from '../artifacts/contracts/Vault.sol/Vault.json'
import ValidatorPicker from '../artifacts/contracts/ValidatorPicker.sol/ValidatorPicker.json'
import moment from 'moment-timezone'

async function main() {
    const SFC = '0xFC00FACE00000000000000000000000000000000'
    const VALIDATOR_PICKER = '0xb09101eC9B3EC745129aC8e9c8a45F90B23c483C'
    const FTM_STAKING_PROXY = '0xB458BfC855ab504a8a327720FcEF98886065529b'
    const ONE_HOUR_IN_SECONDS = 1 * 60 * 60

    const validatorIds = [
        67, // maybe not
        37, // fiery 500k
        63, // fiery 500k
        129, // mcjigs 500k
        48, // 1M fantom india
    ]

    const sfcContract = await ethers.getContractAt(SFCContract.abi, SFC)

    for (const validatorId of validatorIds) {
        const validatorInfo = await sfcContract.getValidator(validatorId)
        const validatorAuth = validatorInfo[6]
        console.log(validatorAuth)
        const lockupInfo = await sfcContract.getLockupInfo(validatorAuth, validatorId)
        const endTimestamp = lockupInfo[2] as number
        const endTime = moment.unix(endTimestamp)
        const secondsToEndtime = endTimestamp - moment().utc().unix()
        const maxLock = secondsToEndtime - ONE_HOUR_IN_SECONDS * 12

        console.log(
            `Validator ${validatorId} locked until ${endTime} which is in ${secondsToEndtime / 60 / 60 / 24} days`,
        )
        console.log(`Max lock duration (minus 12 hours) is ${maxLock} which is in ${maxLock / 60 / 60 / 24} days`)

        console.log(`-----------------------------`)
        console.log(`ValidatorId: ${validatorId}`)
        console.log(`Duration: ${maxLock}`)
        console.log(`-----------------------------`)
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
