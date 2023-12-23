import { ethers, run } from 'hardhat';

async function main() {
  const contractAddress = process.env.DEPLOYED_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw Error('Please specify a contract address');
  }
  const exchange = await ethers.getContractAt('ExchangeV4', contractAddress);

  await run('verify:verify', {
    address: exchange.address,
    constructorArguments: [],
  });
  console.log('Verify done');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
