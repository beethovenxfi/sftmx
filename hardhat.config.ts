import { HardhatUserConfig } from 'hardhat/config'
import '@openzeppelin/hardhat-upgrades'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
// import 'hardhat-typechain'
import 'dotenv/config'
// import '@nomicfoundation/hardhat-verify'

const accounts = [`0x${process.env.DEPLOYER!}`]

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.7',
        settings: {
            optimizer: {
                enabled: true,
                runs: 300,
            },
        },
    },
    // abiExporter: {
    //     path: './abi',
    //     clear: false,
    //     flat: true,
    // },
    // defaultNetwork: 'hardhat',
    // etherscan: {
    //     apiKey: process.env.ETHERSCAN_API_KEY,
    // },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    // gasReporter: {
    //     coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    //     currency: 'USD',
    //     enabled: process.env.REPORT_GAS === 'true',
    //     excludeContracts: ['contracts/mocks/', 'contracts/libraries/'],
    // },
    mocha: {
        timeout: 10000000,
    },
    // namedAccounts: {
    //     deployer: 0,
    // },
    networks: {
        hardhat: {
            // accounts: [
            //     {
            //         privateKey: `0x${process.env.DEPLOYER!}`,
            //         balance: '100000000000000000000000',
            //     },
            // ],
            forking: {
                url: 'https://rpc.ftm.tools/',
                blockNumber: 87419145,
            },
        },
        ropsten: {
            url: process.env.ROPSTEN_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        fantom: {
            url: 'https://rpc2.fantom.network/',
            chainId: 250,
            // gasPrice: 220 * 1e9,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        fantomtest: {
            url: 'https://rpc.testnet.fantom.network/',
            chainId: 4002,
            // gasPrice: 220 * 1e9,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        sonic: {
            url: 'https://rpcapi.sonic.fantom.network/',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        optimism: {
            url: 'https://mainnet.optimism.io',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
    },
    // typechain: {
    //     outDir: 'types',
    //     target: 'ethers-v5',
    // },
}

export default config
