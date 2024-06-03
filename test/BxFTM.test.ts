import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers, upgrades } from 'hardhat'
import helpers from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

// run fork
// yarn hardhat node --fork https://rpc.ftm.tools/ --fork-block-number 70695979 --no-deploy
// run test
// yarn hardhat test .\test\BeethovenxMasterChef.test.ts --grep "BeethovenxMasterChef multiple deposits into pool that once had emissions"

describe('Testing FTM staking', function () {
    let bxFTM: Contract
    let owner: SignerWithAddress
    let dev: SignerWithAddress
    let treasury: SignerWithAddress
    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress
    let sfcMock: Contract
    let ftmStaking: Contract
    let validatorId = 24

    before(async function () {
        const signers = await ethers.getSigners()
        owner = signers[0]
        dev = signers[1]
        treasury = signers[2]
        alice = signers[4]
        bob = signers[5]
        carol = signers[6]
        sfcMock = await ethers.deployContract('SFCMock')
        bxFTM = await ethers.deployContract('bxFTM')
        ftmStaking = await deployFTMStaking(bxFTM, sfcMock.address)

        const pickerAddress = await ftmStaking.validatorPicker()
        const picker = await ethers.getContractAt('ValidatorPicker', pickerAddress)

        await picker.setNextValidatorInfo(validatorId, 365)
        console.log('Set the next validator to 24')
    })

    // beforeEach(async function () {
    //     // bxFTM = await deployContract('bxFTM', [])
    // })
    // // it('test forking', async () => {
    // //     const masterchef = (await ethers.getContractAt('BeethovenxMasterChef', MASTERCHEF)) as BeethovenxMasterChef
    // //     const poolInfo = await masterchef.poolInfo(POOLID)
    // //     console.log(`alloc point: ${poolInfo.allocPoint.toString()}`)
    // // })

    it('test staking and minting bxftm with 1:1 rate', async () => {
        // const ftmStaking = await deployFTMStaking(bxFTM, sfc.address)

        await ftmStaking.connect(alice).deposit({ value: ethers.utils.parseUnits('100') })
        let aliceFtmxBalance = await bxFTM.balanceOf(alice.address)
        let totalFtm = await ftmStaking.totalFTMWorth()
        expect(totalFtm).to.be.equal(ethers.utils.parseUnits('100'))
        expect(aliceFtmxBalance).to.be.equal(ethers.utils.parseUnits('100'))

        await ftmStaking.connect(alice).deposit({ value: ethers.utils.parseUnits('50') })
        aliceFtmxBalance = await bxFTM.balanceOf(alice.address)
        totalFtm = await ftmStaking.totalFTMWorth()

        expect(totalFtm).to.be.equal(ethers.utils.parseUnits('150'))
        expect(aliceFtmxBalance).to.be.equal(ethers.utils.parseUnits('150'))
    })

    it('locking', async () => {
        await ftmStaking.lock(ethers.utils.parseUnits('100'))
        const totalFtm = await ftmStaking.totalFTMWorth()
        const poolBalance = await ftmStaking.getPoolBalance()
        const vaultCount = await ftmStaking.currentVaultCount()

        expect(totalFtm).to.be.equal(ethers.utils.parseUnits('150'))
        expect(poolBalance).to.be.equal(ethers.utils.parseUnits('50'))
        expect(vaultCount).to.be.equal(1)
    })

    it('adding rewards and increase rate', async () => {
        const rateBefore = (await ftmStaking.getExchangeRate()) as BigNumber
        const vaultAddress = await ftmStaking.getVault(0)
        const protocolFeeBIPS = await ftmStaking.protocolFeeBIPS()
        await sfcMock.setPendingRewards(vaultAddress, validatorId, ethers.utils.parseUnits('1'), {
            value: ethers.utils.parseUnits('1'),
        })

        const vault = await ethers.getContractAt('Vault', vaultAddress)
        const vaultStake = await vault.currentStakeValue(protocolFeeBIPS)

        const totalFtm = await ftmStaking.totalFTMWorth()
        const poolBalance = await ftmStaking.getPoolBalance()
        const vaultCount = await ftmStaking.currentVaultCount()
        const rateAfter = (await ftmStaking.getExchangeRate()) as BigNumber
        const rateDiff = rateAfter.sub(rateBefore)

        expect(totalFtm).to.be.equal(ethers.utils.parseUnits('151'))
        expect(vaultStake).to.be.equal(ethers.utils.parseUnits('101'))
        expect(poolBalance).to.be.equal(ethers.utils.parseUnits('50'))
        expect(vaultCount).to.be.equal(1)
        expect(rateBefore).not.to.be.equal(rateAfter)
        expect(rateDiff).not.to.be.equal(0)
    })

    it('harvest rewards, pay fees and keep rate', async () => {
        await ftmStaking.setProtocolFeeBIPS(1000) // 10%
        const rateBefore = (await ftmStaking.getExchangeRate()) as BigNumber
        const vaultAddress = await ftmStaking.getVault(0)
        await sfcMock.setCurrentEpoch(1)
        await ftmStaking.claimRewardsAll()

        const totalFtm = await ftmStaking.totalFTMWorth()
        const poolBalance = await ftmStaking.getPoolBalance()
        const vaultCount = await ftmStaking.currentVaultCount()
        const rateAfter = (await ftmStaking.getExchangeRate()) as BigNumber
        const rateDiff = rateAfter.sub(rateBefore)
        console.log(rateBefore)
        console.log(rateAfter)
        console.log(totalFtm)
        console.log(poolBalance)
        console.log(rateDiff)

        // expect(totalFtm).to.be.equal(151)
        // expect(poolBalance).to.be.equal(50)
        // expect(vaultCount).to.be.equal(1)
        expect(rateBefore).to.be.equal(rateAfter)
        expect(rateDiff).to.be.equal(0)
    })
})

async function deployFTMStaking(bxFTM: any, SFC: string) {
    const picker = await ethers.deployContract('ValidatorPicker')

    console.log(`Picker deployed to ${picker.address}`)

    const oneMinute = 60
    const oneHour = 60 * oneMinute
    const oneDay = 24 * oneHour
    const oneWeek = 7 * oneDay

    const maxVaultCount = 200

    // const SFC = '0xFC00FACE00000000000000000000000000000000'
    // const SFC = sfc.address

    const VALIDATOR_PICKER = picker.address

    const SFCPenalty = await ethers.getContractFactory('contracts\\libraries\\SFCPenalty.sol:SFCPenalty')
    const sfcPenalty = await SFCPenalty.deploy()
    await sfcPenalty.deployed()

    const FTMStaking = await ethers.getContractFactory('contracts\\FTMStaking.sol:FTMStaking', {
        libraries: {
            SFCPenalty: sfcPenalty.address,
        },
    })

    const ftmStaking = await upgrades.deployProxy(FTMStaking, [bxFTM.address, SFC, maxVaultCount, oneHour, oneWeek], {
        kind: 'uups',
        timeout: 0,
        unsafeAllowLinkedLibraries: true,
    })
    await ftmStaking.deployed()
    console.log('FTMStaking deployed to', ftmStaking.address)

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(ftmStaking.address)
    console.log('Implementation address is:', implementationAddress)

    let MINTER_ROLE = await bxFTM.MINTER_ROLE()
    await bxFTM.grantRole(MINTER_ROLE, ftmStaking.address)
    console.log('Added FTMStaking as minter in FTMx')

    await ftmStaking.setValidatorPicker(VALIDATOR_PICKER)
    console.log('set validator picker on ftmstaking')

    await ftmStaking.setDepositLimits('1000000000000000000', '1000000000000000000000000000')
    console.log(
        `Setting deposit limits to min ${ethers.utils.formatUnits(
            '1000000000000000000',
        )} and max ${ethers.utils.formatUnits('1000000000000000000000000000')}`,
    )

    return ftmStaking
}
