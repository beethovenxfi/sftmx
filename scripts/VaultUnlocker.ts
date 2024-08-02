import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import FTMStakingAbi from '../artifacts/contracts/FTMStaking.sol/FTMStaking.json'
import VaultAbi from '../artifacts/contracts/Vault.sol/Vault.json'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { Contract } from 'ethers'
import { advanceToTime, deployContract, getLatestBlock } from './utils'

const FTM_STAKING_PROXY = '0xB458BfC855ab504a8a327720FcEF98886065529b'
const AFFECTED_VAULT_300K = '0x843ee31bedf709840bd45465ea6ac57f291549d4' //300k id 46
const AFFECTED_VAULT_500K = '0xa6d0c1467a6e7a1ba8bcebede9476b6a2897aa5e' //500k id 42
const AFFECTED_VAULT_200K = '0x86de5ec38419b3401f9db78b449d23f5d92ff888' //200k id 39
const TREASURY_ADDRESS = '0xa1E849B1d6c2Fd31c63EEf7822e9E0632411ada7'
const SEVEN_DAYS_IN_SECONDS = 86400 * 7

// run fork
// yarn hardhat node --fork https://rpc.ftm.tools/ --fork-block-number 87543149
// run test
// yarn hardhat test .\scripts\VaultUnlocker.ts --network localhost

describe('Undelegate from vault and withdraw', function () {
    let owner: SignerWithAddress

    before(async function () {
        const signers = await ethers.getSigners()
        owner = signers[0]
    })

    it('test forking', async () => {
        const staking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)

        const vault = await staking.currentVaultCount()
        console.log('vault count', vault)
    })

    it('retrieve excess FTM', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const treasury = await ethers.getImpersonatedSigner(TREASURY_ADDRESS)

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        const balanceTreasuryBefore = await ethers.provider.getBalance(TREASURY_ADDRESS)

        // fund the unlocker
        const tx = {
            to: vaultUnlocker.address,
            value: parseEther('1000'),
        }
        const fundTxn = await treasury.sendTransaction(tx)
        await fundTxn.wait()

        const retrieveTxn = await vaultUnlocker.connect(treasury).retrieveFtm()
        await retrieveTxn.wait()

        const balanceTreasuryAfter = await ethers.provider.getBalance(TREASURY_ADDRESS)
        const balanceUnlockerAfter = await ethers.provider.getBalance(vaultUnlocker.address)

        console.log(`Treasury balance diff: ${formatEther(balanceTreasuryAfter.sub(balanceTreasuryBefore))}`)

        expect(balanceUnlockerAfter).to.be.equal(0)
        // only some gas used
        expect(parseFloat(formatEther(balanceTreasuryBefore.sub(balanceTreasuryAfter)))).to.be.lessThan(0.01)
    })

    it('revert if not treasury for unlock', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // unlock the vault
        await expect(vaultUnlocker.unlockVault()).to.be.revertedWith('ERR_UNAUTHORIZED_CALLER')
    })

    it('revert if not owner for ownership', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const treasury = await ethers.getImpersonatedSigner(TREASURY_ADDRESS)

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // revert the ownership
        await expect(vaultUnlocker.connect(treasury).revertOwnership()).to.be.revertedWith('ERR_UNAUTHORIZED')
    })

    it('revert ownership of the contract', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const staking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)
        const vault = await ethers.getContractAt(VaultAbi.abi, VAULT_ADDRESS)
        const treasury = await ethers.getImpersonatedSigner(TREASURY_ADDRESS)

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // change owner of vault
        const changeOwnerTxn = await staking.connect(treasury).updateVaultOwner(vault.address, vaultUnlocker.address)
        await changeOwnerTxn.wait()
        console.log('Change owner successfull')

        expect(await vault.owner()).to.be.equal(vaultUnlocker.address)

        const revertOwnerTxn = await vaultUnlocker.connect(treasury).revertOwnership()
        await revertOwnerTxn.wait()
        console.log('revert owner successfull')

        expect(await vault.owner()).to.be.equal(FTM_STAKING_PROXY)
    })

    it('revert if not treasury for ownership', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // revert the ownership
        await expect(vaultUnlocker.revertOwnership()).to.be.revertedWith('ERR_UNAUTHORIZED_CALLER')
    })

    it('revert if not owner', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const treasury = await ethers.getImpersonatedSigner(TREASURY_ADDRESS)

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // unlock the vault
        await expect(vaultUnlocker.connect(treasury).unlockVault()).to.be.revertedWith('ERR_UNAUTHORIZED')
    })

    it('revert if not enough FTM', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K

        const staking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)
        const vault = await ethers.getContractAt(VaultAbi.abi, VAULT_ADDRESS)
        const treasury = await ethers.getImpersonatedSigner(TREASURY_ADDRESS)

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // fund the unlocker
        const tx = {
            to: vaultUnlocker.address,
            value: parseEther('100'),
        }
        const fundTxn = await treasury.sendTransaction(tx)
        await fundTxn.wait()
        console.log('Funding successfull')

        // change owner of vault
        const changeOwnerTxn = await staking.connect(treasury).updateVaultOwner(vault.address, vaultUnlocker.address)
        await changeOwnerTxn.wait()
        console.log('Change owner successfull')

        // unlock the vault
        await expect(vaultUnlocker.connect(treasury).unlockVault()).to.be.revertedWith('ERR_INSUFFICIENT_FUNDS')

        const retrieveTxn = await vaultUnlocker.connect(treasury).retrieveFtm()
        await retrieveTxn.wait()
        console.log('Retrieval successfull')

        const revertOwnerTxn = await vaultUnlocker.connect(treasury).revertOwnership()
        await revertOwnerTxn.wait()
        console.log('revert owner successfull')
    })

    it('withdraw from vault to staking', async () => {
        const VAULT_ADDRESS = AFFECTED_VAULT_200K
        const vaultId = 39

        const staking = await ethers.getContractAt(FTMStakingAbi.abi, FTM_STAKING_PROXY)
        const vault = await ethers.getContractAt(VaultAbi.abi, VAULT_ADDRESS)
        const treasury = await ethers.getImpersonatedSigner(TREASURY_ADDRESS)

        const vaultUnlocker = (await deployContract('VaultUnlocker', [FTM_STAKING_PROXY, VAULT_ADDRESS])) as Contract

        // fund the unlocker
        const tx = {
            to: vaultUnlocker.address,
            value: parseEther('1000'),
        }
        const fundTxn = await treasury.sendTransaction(tx)
        await fundTxn.wait()
        console.log('Funding successfull')

        // change owner of vault
        const changeOwnerTxn = await staking.connect(treasury).updateVaultOwner(vault.address, vaultUnlocker.address)
        await changeOwnerTxn.wait()
        console.log('Change owner successfull')

        const balanceTreasuryBefore = await ethers.provider.getBalance(TREASURY_ADDRESS)
        const rateBefore = await staking.getExchangeRate()
        const totalFtmBefore = await staking.totalFTMWorth()

        // unlock the vault
        const unlockTxn = await vaultUnlocker.connect(treasury).unlockVault()
        await unlockTxn.wait()
        console.log('unlock successful')

        const retrieveTxn = await vaultUnlocker.connect(treasury).retrieveFtm()
        await retrieveTxn.wait()
        console.log('Retrieval successfull')

        const balanceTreasuryAfter = await ethers.provider.getBalance(TREASURY_ADDRESS)
        const balanceUnlockerAfter = await ethers.provider.getBalance(vaultUnlocker.address)

        console.log(`Treasury balance diff: ${formatEther(balanceTreasuryAfter.sub(balanceTreasuryBefore))}`)

        // check that rate and total FTM are identical
        const rateAfter = await staking.getExchangeRate()
        const vaultOwnerAfter = await vault.owner()
        const totalFtmAfter = await staking.totalFTMWorth()

        expect(vaultOwnerAfter).to.be.equal(FTM_STAKING_PROXY)
        expect(balanceUnlockerAfter).to.be.equal(0)
        expect(formatEther(rateBefore.sub(rateAfter))).to.be.equal('0.0')
        expect(formatEther(totalFtmBefore.sub(totalFtmAfter))).to.be.equal('0.0')

        console.log('Unlock and refill successfull')

        const maturedVaultsCount = await staking.getMaturedVaultLength()
        expect(maturedVaultsCount).to.be.equal(0)

        // harvest the vault
        const harvestTxn = await staking.harvestVault(vaultId)
        await harvestTxn.wait()

        const maturedVaultsCountAfterHarvest = await staking.getMaturedVaultLength()
        expect(maturedVaultsCountAfterHarvest).to.be.equal(1)

        console.log('Harvest successfull')

        // advance 7 days to make withdrawal possible
        const currentTimestamp = (await getLatestBlock()).timestamp
        await advanceToTime(currentTimestamp + SEVEN_DAYS_IN_SECONDS + 1000)

        const ftmInPoolBefore = await staking.getPoolBalance()

        // withdraw the funds to the pool of staking contract
        const withdrawTxn = await staking.withdrawMatured(0)
        await withdrawTxn.wait()

        const ftmInPoolFinish = await staking.getPoolBalance()
        const rateFinish = await staking.getExchangeRate()
        const totalFtmFinish = await staking.totalFTMWorth()
        expect(formatEther(rateBefore.sub(rateFinish))).to.be.equal('0.0')
        expect(formatEther(totalFtmBefore.sub(totalFtmFinish))).to.be.equal('0.0')
        // make sure that the pool balance has increased after harvest
        expect(parseFloat(formatEther(ftmInPoolFinish.sub(ftmInPoolBefore)))).to.be.greaterThan(0)
    })
})
