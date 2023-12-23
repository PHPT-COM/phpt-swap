const { ethers, upgrades } = require('hardhat');

async function main() {
  const contractAddress = process.env.DEPLOYED_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw Error('Please specify a contract address');
  }
  const ExchangeV3 = await ethers.getContractFactory('ExchangeV3');
  await upgrades.upgradeProxy(contractAddress, ExchangeV3);
  console.log('Upgraded contract address: ' + contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
