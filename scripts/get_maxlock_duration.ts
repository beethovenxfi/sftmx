// yarn hardhat run --network fantom .\scripts\get_maxlock_duration.ts
// @ts-ignore
import { ethers } from 'hardhat'
import SFCContract from '../artifacts/contracts/interfaces/ISFC.sol/ISFC.json'
import moment from 'moment-timezone'
import fs from 'fs'
import { parseUnits } from 'ethers/lib/utils'

interface SafeTransactionBatch {
    version: string
    chainId: string
    createdAt: number
    meta: Meta
    transactions: Transaction[]
}

interface Meta {
    name: string
    description: string
    txBuilderVersion: string
    createdFromSafeAddress: string
    createdFromOwnerAddress: string
    checksum: string
}

interface Transaction {
    to: string
    value: string
    data: any
    contractMethod: ContractMethod
    contractInputsValues: ContractInputsValues
}

interface ContractMethod {
    inputs: Input[]
    name: string
    payable: boolean
}

interface Input {
    name: string
    type: string
    internalType?: string
}

export interface ContractInputsValues {
    toValidatorID?: string
    lockupDuration?: string
    amount?: string
}

const SFC = '0xFC00FACE00000000000000000000000000000000'
const VALIDATOR_PICKER = '0x3ea7B81689C5161882f51c57Aa0049D7C5E46A0E'
const FTM_STAKING_PROXY = '0xB458BfC855ab504a8a327720FcEF98886065529b'

async function main() {
    const ONE_HOUR_IN_SECONDS = 60 * 60
    const ONE_DAY_IN_SECONDS = 24 * ONE_HOUR_IN_SECONDS
    const ONE_YEAR_IN_SECONDS = 365 * ONE_DAY_IN_SECONDS

    const validatorsToDelegate = [
        {
            validatorId: 168,
            amount: 450000,
            duration: 0,
        },
        // {
        //     validatorId: 51,
        //     amount: 500000,
        //     duration: 0,
        // },
        // {
        //     validatorId: 63,
        //     amount: 500000,
        //     duration: 0,
        // },
        // {
        //     validatorId: 145,
        //     amount: 1000000,
        //     duration: 0,
        // },
        // {
        //     validatorId: 146,
        //     amount: 1000000,
        //     duration: 0,
        // },
        // {
        //     validatorId: 147,
        //     amount: 1000000,
        //     duration: 0,
        // },
    ]

    const sfcContract = await ethers.getContractAt(SFCContract.abi, SFC)

    for (const validator of validatorsToDelegate) {
        const validatorInfo = await sfcContract.getValidator(validator.validatorId)
        const validatorAuth = validatorInfo[6]
        const lockupInfo = await sfcContract.getLockupInfo(validatorAuth, validator.validatorId)
        const endTimestamp = lockupInfo[2] as number
        const endTime = moment.unix(endTimestamp)
        const secondsToEndtime = endTimestamp - moment().utc().unix()
        if (secondsToEndtime < ONE_YEAR_IN_SECONDS - 30 * ONE_DAY_IN_SECONDS) {
            validator.duration = secondsToEndtime + 29 * ONE_DAY_IN_SECONDS
        } else {
            validator.duration = ONE_YEAR_IN_SECONDS
        }
        const maxLock = validator.duration

        console.log(
            `Validator ${validator.validatorId} locked until ${endTime} which is in ${
                secondsToEndtime / 60 / 60 / 24
            } days or ${secondsToEndtime} seconds`,
        )
        console.log(`Max lock duration is ${maxLock} which is in ${maxLock / 60 / 60 / 24} days`)

        console.log(`-----------------------------`)
        console.log(`ValidatorId: ${validator.validatorId}`)
        console.log(`Duration: ${maxLock} (${maxLock / 60 / 60 / 24} days)`)
        console.log(`Amount: ${validator.amount}`)
        console.log(`-----------------------------`)
    }
    createTxnBatch(validatorsToDelegate)
}

function createTxnBatch(
    validators: {
        validatorId: number
        amount: number
        duration: number
    }[],
) {
    let lockTxns: Transaction[] = []
    let name: string

    for (const validator of validators) {
        const ftmAmountScaled = parseUnits(`${validator.amount}`, 18)

        // setNextValidator info with validator ID and duration on validatorpicker contract
        lockTxns.push({
            to: VALIDATOR_PICKER,
            value: '0',
            data: null,
            contractMethod: {
                inputs: [
                    {
                        internalType: 'uint256',
                        name: 'toValidatorID',
                        type: 'uint256',
                    },
                    {
                        internalType: 'uint256',
                        name: 'lockupDuration',
                        type: 'uint256',
                    },
                ],
                name: 'setNextValidatorInfo',
                payable: false,
            },
            contractInputsValues: {
                toValidatorID: validator.validatorId.toString(),
                lockupDuration: validator.duration.toString(),
            },
        })

        // lock to the previously set validator
        lockTxns.push({
            to: FTM_STAKING_PROXY,
            value: '0',
            data: null,
            contractMethod: {
                inputs: [
                    {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                    },
                ],
                name: 'lock',
                payable: false,
            },
            contractInputsValues: {
                amount: ftmAmountScaled.toString(),
            },
        })
    }

    if (lockTxns.length > 0) {
        const transactionBatch: SafeTransactionBatch = {
            version: '1.0',
            chainId: '250',
            createdAt: 1678892613523,
            meta: {
                name: 'Transactions Batch',
                description: '',
                txBuilderVersion: '1.16.3',
                createdFromSafeAddress: '0xa1E849B1d6c2Fd31c63EEf7822e9E0632411ada7',
                createdFromOwnerAddress: '',
                checksum: '0x9055a79728fb3ff687a24ae4718e700bda884f9a4f86dc9570621d7b7782ba0f',
            },
            transactions: lockTxns,
        }

        name = `lock_ftm_${new Date().getTime()}.json`

        fs.writeFileSync(name, JSON.stringify(transactionBatch, null, 2))
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
