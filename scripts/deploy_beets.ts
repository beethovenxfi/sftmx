import { upgrades, ethers } from 'hardhat'

async function main() {
    const picker = await ethers.deployContract('ValidatorPicker')

    console.log(`Picker deployed to ${picker.address}`)

    const oneMinute = 60
    const oneHour = 60 * oneMinute
    const oneDay = 24 * oneHour
    const oneWeek = 7 * oneDay

    const maxVaultCount = 200

    const SFC = '0xFC00FACE00000000000000000000000000000000'
    const VALIDATOR_PICKER = picker.address

    const SFCPenalty = await ethers.getContractFactory('contracts\\libraries\\SFCPenalty.sol:SFCPenalty')
    const sfcPenalty = await SFCPenalty.deploy()
    await sfcPenalty.deployed()

    const bxFTMFactory = await ethers.getContractFactory('contracts\\bxFTM.sol:bxFTM')
    const FTMStaking = await ethers.getContractFactory('contracts\\FTMStaking.sol:FTMStaking', {
        libraries: {
            SFCPenalty: sfcPenalty.address,
        },
    })

    const bxFTM = await bxFTMFactory.deploy()
    await bxFTM.deployed()
    console.log('bxFTM deployed to', bxFTM.address)

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
    console.log('Set the validator picker')

    console.log('Val picker is', await ftmStaking.validatorPicker())

    //need to set deposit limits min: 1, max: 10000000
    // need to set fee
    // need to set treasury address
    // need to set next validator ID on validator picker

    // const FTMStakingV1_1 = await ethers.getContractFactory("contracts\\FTMStakingV1_1.sol:FTMStakingV1_1", {
    //   libraries: {
    //     SFCPenalty: sfcPenalty.address,
    //   },
    // });

    // await upgrades.upgradeProxy(ftmStaking.address, FTMStakingV1_1, { unsafeAllowLinkedLibraries: true });

    // console.log("Val picker is", await ftmStaking.validatorPicker());

    // const implementationAddress2 = await hre.upgrades.erc1967.getImplementationAddress(ftmStaking.address);
    // console.log("Implementation address is:", implementationAddress2);

    // const ftmStakingV1_1 = await FTMStakingV1_1.attach(ftmStaking.address);

    // await ftmStakingV1_1.setLockerAdmin(SFC);

    // console.log("lockerAdmin is", await ftmStakingV1_1.lockerAdmin());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
