import { run, ethers } from 'hardhat'

async function main() {
    const vaultUnlocker = await ethers.deployContract('VaultUnlocker')

    console.log(`Unlocker deployed to ${vaultUnlocker.address}`)

    await run('verify:verify', {
        address: vaultUnlocker.address,
        constructorArguments: [],
    })
    console.log(`Unlocker verified`)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
