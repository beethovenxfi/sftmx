import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import FTMStakingAbi from '../artifacts/contracts/FTMStaking.sol/FTMStaking.json'
import FTMStakingAbiHf1 from '../artifacts/contracts/FTMStaking.sol/FTMStaking.json'
import VaultAbi from '../artifacts/contracts/Vault.sol/Vault.json'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { BigNumber, Contract } from 'ethers'
import { ADDRESS_ZERO } from './utils'

const FTM_STAKING_PROXY = '0xB458BfC855ab504a8a327720FcEF98886065529b'
const TREASURY_ADDRESS = '0xa1E849B1d6c2Fd31c63EEf7822e9E0632411ada7'
const SFTMX = '0xd7028092c830b5C8FcE061Af2E593413EbbC1fc1'
const sftmxHolders = [
    '0x20dd72ed959b6147912c2e529f0a0c651c33c9ce',
    '0x4bf6f3210488091a0111daf7ab7cf840a3af8022',
    '0x43e1059c05d3153b5d74303dd6474a43bc87e73e',
    '0x6ff6dfac4b8bea957dc48aad626d7631c2ba208c',
    '0xd3c6166da8b69e9a67fdcd6f79abae98e3d05238',
    '0xb36c7855fc4285795e89a88ad44393ab2e65101d',
    '0xdc46bb979bf5102d78ece8e9a91dbaec932e756a',
    '0x0b2e90c831626a65a26f75153be54aeaaeeb8363',
    '0x4bef26fa85c3b5c620c760f8f5427a520d9a0565',
    '0x6c99c45b39d1cddb61b272798ea1da2cdac9bcc8',
    '0x815400bf42a37af49f0229b502a15c880ad14ad2',
    '0x483e9c78cff1c1abda5bf1b974ac9a8bd864f59f',
    '0x939a783ec762311c7d21689f174c4c9654a4575b',
    '0xd80d101a78507fb49eddb358a5493d71a19b9178',
    '0x9eb408e53dfa0c877b65bbe874de81247212380e',
    '0x4b776b2e8db074d4a57a199419b113a9c909d04f',
    '0xe67980fc955fecfda8a92bbbfbcc9f0c4be60a9a',
    '0x4795d6aab64ac9c3a1e4718931a13e775a5350b5',
    '0xd93d8846ee7d8c47ee38e767be562ccdb7530b5b',
    '0xcde771cb4b774d9e78192d111ab45a34cf60e583',
    '0xe22867ffa5314518441fe1e9ef9888a90c418b4d',
    '0x1f92b5affd12981ef0fa7ba22a802379fd36929e',
    '0x17f05968c301bb29bdcd62780e6c5e6381a68f63',
    '0x1484b77fc032136739dbd0029800b58a7cc9066d',
    '0x8105e062d6b94c951e93739aee33018bd6a6d1c7',
    '0x36804abb20cb8c19b860d3c9bf7219a88b8fc57a',
    '0xcc656162f9f157860bb7309b72374ece447e327a',
    '0x9f3fb738ff7c1d0f4f902265264a03189e6c7d37',
    '0x7fc54d3b0871ef10e472e79748b379c13eedb6fb',
    '0x89b24920e787ea34a661ea1288adda53f658839a',
    '0xf0c2879c65712b13e99b2e4c0762027126d57677',
    '0x31f585dcc004a70cd7be6bb62296d7879da7fcfa',
    '0x2f463642fa60cb1f1fd1c57af25b34b7a9a99586',
    '0xdb7bbd7445d149cbd8650901d1d76a27545044f0',
    '0x077ca158f44c2013828c6d9e4b0116d8c367b8dd',
    '0xed75bf898c98069360071fda9b0dc6af104d96d1',
    '0x48d18645e747c86def0ac3db8c391a36c04729ab',
    '0xb8572623237648af0896171e3e53533e159d8f9a',
    '0x211b2278d89fc9df9396b6769ff0c0378d9ee6fe',
    '0xd34815d8b5ef0cc2dfff24f6ba8b1dccfba04b93',
    '0x8fc535683cddc39d710358309299c36a7b121512',
    '0xd3ab581c5725f3a50a602c3c19d39a5b2763fa23',
    '0xfbe75007345a5dd8a92a6fdae62e9a7da2ddac01',
    '0x420e485883bb90146c9d086378f8a20b1b7e8687',
    '0xdb6adb08cd839521ce471845d099b26e2d006894',
    '0x2df44f531f9b8cd82f181f7e3f3401e392f1b19e',
    '0x3236d8db3360960e75ae020d58f4c91261af7447',
    '0x8507c2eb02355a2a480698274eee14d8b3813d89',
    '0xd2bed9ff3717572769fcf0fb42319ee764031007',
    '0xce29cec7552ab3c9cf5264ed96081c2804c3ef07',
    '0x6fc9395a9042d33fc99a2604272bf44f3cb831f0',
    '0x79953995c8aed80f4a7796fa7eaa83c0d166699e',
    '0x5275817b74021e97c980e95ede6bbac0d0d6f3a2',
    '0x5ba7614b0b5e901a762af4c03c6a33d85d7b35dd',
    '0x4282890ff9661a51ea367aeddf341c6f6395d4e1',
    '0x3c09789c44044f0d0c92de4a01584326a4ca559a',
    '0xf320ea21a2a7a4bace35a8e6980533e7a1cb78c8',
    '0xffebf6d66311148429a29ece5745c75d02b331f9',
    '0x276fdb2995ada85742b54fd5119c487751ce1f5f',
    '0x407c63b5295ca2d261f918b4ee135998daa09116',
    '0xd7be210e029231952b59aa8a64e91b8de5466e14',
    '0xa80d5e640225358d04b59189ba5251eb917b4166',
    '0xe80a0a301d4affc9527d9093c645c6920ffeae1d',
    '0x3a15cac48a2fd24f5c480e2d0a97d388ac418c02',
    '0x41a6ac7f4e4dbffeb934f95f1db58b68c76dc4df',
    '0x7857c95b968151bbb734115921d0792c1a67e006',
    '0x37d7bd517b1a37a9a2cc9da5243854107f17405e',
    '0x589ffaeab4a99275660a9fa4274cb58f7329f4df',
    '0x895f6b252d1f02d0a70aae23f4269de4d6d49589',
    '0x1b52ae6662bd445aa77ccc61596b7b6fe3d9be1b',
    '0x622ed824050bec39e64e19ade462093a763cc5e9',
    '0xa7a7e108a88e137ff754306a9501e65c980a65e6',
    '0x4d614298209723d25a1ee385730b9e4586041948',
    '0x2e9218670d1fc62f9a76ccd94bdf48ebe41bd36e',
    '0x5daf884b73f6ab637d72bf09475a8455121614e6',
    '0x5b3067c5e26fec823d6fbf8f315e43632658d2f6',
    '0x289048d12e59ccbece1b4126a81e5a5ec8d1a7af',
    '0xeb1b7c571acbd461db3386ee6a3fbe4d375788e9',
    '0xd4f02a1c94706b8b9123f2be11125bff772ac4f0',
    '0x732e10bb4738fea52f43d78d231e152ca061374d',
    '0x9dadb5473a1672fbc8f2441d1d1522ac06f67880',
    '0x53d7c9d7ea188d877809075ed255b9ae49b0d89d',
    '0x8b91d3530402c141825b7e8c3a352a5fb9f45ca0',
    '0xc40593a4242d0b6bd1aa895a1db4f756f9ed1b35',
    '0x44d61ea1670efe4e844383a339f46baf37613772',
    '0x541c8de302104bb8996f0b1bb4689520eeab2384',
    '0x5d0af5a949d65bc9e8c2f8be252f7d0f76816a00',
    '0xef46b09b69647412c129ebd8739bdf0f0c10dccd',
    '0x35fadf310e5c90f38c05f4f30a010cf6e86fc0e9',
    '0x88c222066753b2da14cb34d759441d5ac9d2314f',
]

// run fork
// anvil -f https://rpc.fantom.network --fork-block-number 90032940 --block-base-fee-per-gas 0
// run test
// yarn hardhat test .\scripts\upgrade_ftm_staking.ts --grep 'upgrade proxy' --network localhost

describe('Upgrade staking contract', function () {
    let owner: SignerWithAddress
    let treasurySigner: SignerWithAddress
    let newImplementation: Contract

    it('test forking', async () => {
        const staking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)

        const vault = await staking.currentVaultCount()
        console.log('vault count', vault)
    })

    it('deploy new contract', async () => {
        // need to deploy new, dont know how to find address of currently deployed one
        const SFCPenalty = await ethers.getContractFactory('contracts\\libraries\\SFCPenalty.sol:SFCPenalty')
        const sfcPenalty = await SFCPenalty.deploy()
        await sfcPenalty.deployed()
        console.log('SFCPenalty deployed to:', sfcPenalty.address)

        const FTMStakingV1_HF1 = await ethers.getContractFactory('contracts\\FTMStaking.sol:FTMStaking', {
            libraries: {
                SFCPenalty: sfcPenalty.address,
            },
        })
        console.log('Deploying FTMStakingV1_HF1')
        const ftmStakingHf = await FTMStakingV1_HF1.deploy()
        console.log('Deployed FTMStakingV1_HF1', ftmStakingHf.address)
        newImplementation = ftmStakingHf
    })

    it('upgrade proxy', async () => {
        const ftmStaking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)

        const ownerBefore = await ftmStaking.owner()
        const treasuryBefore = await ftmStaking.treasury()
        const sftmxBefore = await ftmStaking.FTMX()
        const currentVaultPtrBefore = await ftmStaking.currentVaultPtr()
        const maxVaultCountBefore = await ftmStaking.maxVaultCount()
        const currentVaultCountBefore = await ftmStaking.currentVaultCount()
        const totalFTMWorthBefore = await ftmStaking.totalFTMWorth()
        const protocolFeesBIPSBefore = await ftmStaking.protocolFeeBIPS()
        const withdrawalDelayBefore = await ftmStaking.withdrawalDelay()
        const minDepositBefore = await ftmStaking.minDeposit()
        const maxDepositBefore = await ftmStaking.maxDeposit()
        const undelegatePausedBefore = await ftmStaking.undelegatePaused()
        const withdrawPausedBefore = await ftmStaking.withdrawPaused()
        const maintenancePausedBefore = await ftmStaking.maintenancePaused()
        const ftmPendingWithdrawalBefore = await ftmStaking.ftmPendingWithdrawal()
        const getExchangeRateBefore = await ftmStaking.getExchangeRate()

        console.log('Upgrading FTMStakingV1_HF1')
        await ftmStaking.connect(treasurySigner).upgradeTo(newImplementation.address)
        console.log('FTMStakingV1_HF1 upgraded')

        const ownerAfter = await ftmStaking.owner()
        const treasuryAfter = await ftmStaking.treasury()
        const sftmxAfter = await ftmStaking.FTMX()
        const currentVaultPtrAfter = await ftmStaking.currentVaultPtr()
        const maxVaultCountAfter = await ftmStaking.maxVaultCount()
        const currentVaultCountAfter = await ftmStaking.currentVaultCount()
        const totalFTMWorthAfter = await ftmStaking.totalFTMWorth()
        const protocolFeesBIPSAfter = await ftmStaking.protocolFeeBIPS()
        const withdrawalDelayAfter = await ftmStaking.withdrawalDelay()
        const minDepositAfter = await ftmStaking.minDeposit()
        const maxDepositAfter = await ftmStaking.maxDeposit()
        const undelegatePausedAfter = await ftmStaking.undelegatePaused()
        const withdrawPausedAfter = await ftmStaking.withdrawPaused()
        const maintenancePausedAfter = await ftmStaking.maintenancePaused()
        const ftmPendingWithdrawalAfter = await ftmStaking.ftmPendingWithdrawal()
        const getExchangeRateAfter = await ftmStaking.getExchangeRate()

        expect(ownerAfter).to.be.equal(ownerBefore)
        expect(treasuryAfter).to.be.equal(treasuryBefore)
        expect(sftmxAfter).to.be.equal(sftmxBefore)
        expect(currentVaultPtrAfter).to.be.equal(currentVaultPtrBefore)
        expect(maxVaultCountAfter).to.be.equal(maxVaultCountBefore)
        expect(currentVaultCountAfter).to.be.equal(currentVaultCountBefore)
        expect(totalFTMWorthAfter).to.be.equal(totalFTMWorthBefore)
        expect(protocolFeesBIPSAfter).to.be.equal(protocolFeesBIPSBefore)
        expect(withdrawalDelayAfter).to.be.equal(withdrawalDelayBefore)
        expect(minDepositAfter).to.be.equal(minDepositBefore)
        expect(maxDepositAfter).to.be.equal(maxDepositBefore)
        expect(undelegatePausedAfter).to.be.equal(undelegatePausedBefore)
        expect(withdrawPausedAfter).to.be.equal(withdrawPausedBefore)
        expect(maintenancePausedAfter).to.be.equal(maintenancePausedBefore)
        expect(ftmPendingWithdrawalAfter).to.be.equal(ftmPendingWithdrawalBefore)
        expect(getExchangeRateAfter).to.be.equal(getExchangeRateBefore)
    })

    it('shift vaults', async () => {
        const upgradedFtmStaking = await ethers.getContractAt(FTMStakingAbiHf1.abi, FTM_STAKING_PROXY)

        const totalFtmWorth = await upgradedFtmStaking.totalFTMWorth()
        const poolBalance = await upgradedFtmStaking.getPoolBalance()

        const stakeCount = await countStakes(upgradedFtmStaking)

        expect(stakeCount.add(poolBalance)).not.to.be.equal(totalFtmWorth)

        console.log('total ftm worth', totalFtmWorth.toString())
        console.log('stake count', stakeCount.toString())

        await logVaults(upgradedFtmStaking)

        let shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(45, 46)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(44, 45)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(43, 44)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(41, 43)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(40, 42)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(38, 41)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(37, 40)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(36, 39)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(35, 38)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(34, 37)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(33, 36)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(32, 35)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(31, 34)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(30, 33)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(29, 32)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(28, 31)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(27, 30)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(26, 29)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(25, 28)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(24, 27)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(23, 26)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(22, 25)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(21, 24)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(20, 23)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(19, 22)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(18, 21)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(17, 20)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(16, 19)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(15, 18)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(14, 17)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        shiftTxn = await upgradedFtmStaking.connect(treasurySigner).shiftVaultIndex(13, 16)
        await shiftTxn.wait()
        await logVaults(upgradedFtmStaking)

        const totalFtmWorthAfter = await upgradedFtmStaking.totalFTMWorth()

        const stakeCountAfter = await countStakes(upgradedFtmStaking)
        const poolBalanceAfter = await upgradedFtmStaking.getPoolBalance()

        expect(totalFtmWorthAfter).to.be.equal(stakeCountAfter.add(poolBalanceAfter))
    })

    it('withdraw a lot of sftmx', async () => {
        const sftmx = await ethers.getContractAt('ERC20', SFTMX)
        const staking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)

        // transfer a lot of sftmx to owner
        for (const holder of sftmxHolders) {
            const holderSigner = await ethers.getImpersonatedSigner(holder)
            const balancerOfHolder = await sftmx.balanceOf(holder)
            console.log(`Holder ${holder} has ${formatEther(balancerOfHolder)} sftmx`)
            const tx = await sftmx.connect(holderSigner).transfer(owner.address, balancerOfHolder, {
                gasPrice: '0x0',
            })
            await tx.wait()
            console.log(`Transferred sftmx from ${holder}`)
        }

        const sftmxBalanceOfOwnerToUndelegate = await sftmx.balanceOf(owner.address)
        console.log(`Owner has ${formatEther(sftmxBalanceOfOwnerToUndelegate)} sftmx`)

        let increase = 2000000
        const sftmxToUndelegate = parseEther(`${increase}`)
        let i = 1
        let totalUndelegate = BigNumber.from(0)
        let totalFtmWithdrawal = BigNumber.from(0)
        while (sftmxToUndelegate <= sftmxBalanceOfOwnerToUndelegate) {
            console.log(`--------------------- Iteration ${i} ---------------------`)
            const sftmxBalanceOfOwnerToUndelegate = await sftmx.balanceOf(owner.address)
            const sftmxToUndelegate = parseEther(`${increase}`)
            totalUndelegate = totalUndelegate.add(sftmxToUndelegate)

            expect(sftmxToUndelegate).to.be.lte(sftmxBalanceOfOwnerToUndelegate)
            const wrId = 2525251 + i

            const rate = await staking.getExchangeRate()
            const totalFTMWorth = await staking.totalFTMWorth()

            console.log('undelegating sftmx', formatEther(sftmxToUndelegate))
            const undelegateTxn = await staking.undelegate(wrId, sftmxToUndelegate, 0, {
                gasPrice: '0x0',
            })
            await undelegateTxn.wait()

            const rateAfter = await staking.getExchangeRate()
            const totalFTMWorthAfter = await staking.totalFTMWorth()
            console.log('rate diff', formatEther(rateAfter.sub(rate)))

            const currentVaultPtr = await staking.currentVaultPtr()
            console.log('currentVaultPtr', currentVaultPtr)

            for (let i = 50; i > 30; i--) {
                const vaultAddress = await staking.getVault(i)
                if (vaultAddress !== ADDRESS_ZERO) {
                    const vault = await ethers.getContractAt(VaultAbi.abi, vaultAddress)
                    const currentStakedValue = await vault.currentStakeValue()
                    console.log(`Vault ${i} has ${formatEther(currentStakedValue)} FTM`)
                } else {
                    console.log(`Vault ${i} is 0x0`)
                }
            }

            const withdrawalRequest = await staking.allWithdrawalRequests(wrId)

            const withdrawalFromPoolAmount = withdrawalRequest.poolAmount
            const withdrawalFromUndelegateAmount = withdrawalRequest.undelegateAmount

            const receivedFtm = withdrawalFromPoolAmount.add(withdrawalFromUndelegateAmount)
            totalFtmWithdrawal = totalFtmWithdrawal.add(receivedFtm)
            console.log('totalReceivedFtm', formatEther(totalFtmWithdrawal))
            expect(receivedFtm).to.be.gt(parseEther('0'))

            console.log('totalUndelegate', formatEther(totalUndelegate))
            console.log('totalFTMWorth diff', formatEther(totalFTMWorthAfter.sub(totalFTMWorth)))
            expect(totalFTMWorthAfter).to.be.lt(totalFTMWorth)

            i++
        }
    })
})

async function logVaults(ftmStakingHf1: Contract) {
    const currentVaultPtr = await ftmStakingHf1.currentVaultPtr()
    console.log('currentVaultPtr', currentVaultPtr)
    const maxVaultCount = await ftmStakingHf1.maxVaultCount()
    console.log('maxVaultCount', maxVaultCount)
    const currentVaultCount = await ftmStakingHf1.currentVaultCount()
    console.log('currentVaultCount', currentVaultCount)

    for (let i = currentVaultPtr; i > 0; i--) {
        const vaultAddress = await ftmStakingHf1.getVault(i)
        if (vaultAddress === ADDRESS_ZERO) {
            console.log(`Vault ${i} is 0x0`)
        }
    }
}

async function countStakes(ftmStakingHf1: Contract) {
    const currentVaultPtr = await ftmStakingHf1.currentVaultPtr()
    console.log('currentVaultPtr', currentVaultPtr)
    const currentVaultCount = await ftmStakingHf1.currentVaultCount()
    console.log('currentVaultCount', currentVaultCount)

    let total = BigNumber.from(0)

    for (let i = 1; i <= currentVaultCount; i++) {
        const vaultAddress = await ftmStakingHf1.getVault(currentVaultPtr - i)
        if (vaultAddress !== ADDRESS_ZERO) {
            console.log(`Vault ${currentVaultPtr - i} is ${vaultAddress}`)
            const vault = await ethers.getContractAt(VaultAbi.abi, vaultAddress)
            const currentStakeValue = await vault.currentStakeValue()
            total = total.add(currentStakeValue)
        }
    }
    return total
}
