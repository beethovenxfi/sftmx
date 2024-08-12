import axios from 'axios'
import * as dotenv from 'dotenv'
import { ethers } from 'ethers'

dotenv.config()

// assuming environment variables TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG and TENDERLY_ACCESS_KEY are set
// const { TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG, TENDERLY_ACCESS_KEY } = process.env
const TENDERLY_ACCOUNT_SLUG = 'franzns'
const TENDERLY_PROJECT_SLUG = 'project'
const TENDERLY_ACCESS_KEY = 'aj3Pz-77dHS2GAC7d6Qwa25iQj50MNgK'

const batchedSimulations = async () => {
    console.time('Batch Simulation')

    const unlockSqeuence = (
        await axios.post(
            `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_SLUG}/project/${TENDERLY_PROJECT_SLUG}/simulate-bundle`,
            // the transaction
            {
                simulations: getTxSequence().map((transaction) => ({
                    network_id: '250', // network to simulate on
                    save: true,
                    save_if_fails: true,
                    simulation_type: 'full',
                    ...transaction,
                })),
            },
            {
                headers: {
                    'X-Access-Key': TENDERLY_ACCESS_KEY as string,
                },
            },
        )
    ).data
    console.timeEnd('Batch Simulation')
    // console.log(JSON.stringify(daiSequence, null, 2))
}

function getTxSequence() {
    const treasuryAddress = '0xa1E849B1d6c2Fd31c63EEf7822e9E0632411ada7'
    const vaultUnlockerAddress = '0xd0F62fBe32A72CD18Ab8943b52220a7Af6c743f4'
    const AFFECTED_VAULT_200K = '0x86de5ec38419b3401f9db78b449d23f5d92ff888' //200k id 39
    const AFFECTED_VAULT_300K = '0x843ee31bedf709840bd45465ea6ac57f291549d4' //300k id 46
    const AFFECTED_VAULT_500K = '0xa6d0c1467a6e7a1ba8bcebede9476b6a2897aa5e' //500k id 42
    const FTM_STAKING_PROXY = '0xB458BfC855ab504a8a327720FcEF98886065529b'
    return [
        // TX1: Send 5k FTM
        {
            from: treasuryAddress,
            to: vaultUnlockerAddress,
            data: '0x',
            value: '0x10F0CF064DD59200000',
        },
        // TX2: Update owner
        {
            from: treasuryAddress,
            to: FTM_STAKING_PROXY,
            input: '0x6c17f67e00000000000000000000000086de5ec38419b3401f9db78b449d23f5d92ff888000000000000000000000000d0f62fbe32a72cd18ab8943b52220a7af6c743f4',
        },
        // TX3: Unlock vault
        {
            from: treasuryAddress,
            to: vaultUnlockerAddress,
            input: '0x5134982200000000000000000000000086de5ec38419b3401f9db78b449d23f5d92ff888',
        },
        // TX2: Update owner
        {
            from: treasuryAddress,
            to: FTM_STAKING_PROXY,
            input: '0x6c17f67e000000000000000000000000843ee31bedf709840bd45465ea6ac57f291549d4000000000000000000000000d0f62fbe32a72cd18ab8943b52220a7af6c743f4',
        },
        // TX3: Unlock vault
        {
            from: treasuryAddress,
            to: vaultUnlockerAddress,
            input: '0x51349822000000000000000000000000843ee31bedf709840bd45465ea6ac57f291549d4',
        },
        // TX2: Update owner
        {
            from: treasuryAddress,
            to: FTM_STAKING_PROXY,
            input: '0x6c17f67e000000000000000000000000a6d0c1467a6e7a1ba8bcebede9476b6a2897aa5e000000000000000000000000d0f62fbe32a72cd18ab8943b52220a7af6c743f4',
        },
        // TX3: Unlock vault
        {
            from: treasuryAddress,
            to: vaultUnlockerAddress,
            input: '0x51349822000000000000000000000000a6d0c1467a6e7a1ba8bcebede9476b6a2897aa5e',
        },
        // TX3: retrieve ftm
        {
            from: treasuryAddress,
            to: vaultUnlockerAddress,
            input: '0xe701304b',
        },
    ]
}

batchedSimulations()
