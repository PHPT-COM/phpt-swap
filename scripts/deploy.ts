import { ethers, upgrades } from 'hardhat';

async function main() {
  // const phpt = await (await ethers.getContractFactory('Token')).deploy('PHPT', 'PHPT', ethers.utils.parseEther("10000000000000"));
  // const usdt = await (await ethers.getContractFactory('Token')).deploy('USDT', 'USDT', ethers.utils.parseEther("10000000000000"));

  const phptAddr = '0x0bD7241fB1F38765917C42E75eB59946fE212634';
  console.log('PHPT deployed to:', phptAddr);
  const usdtAddr = '0x55d398326f99059ff775485246999027b3197955';
  console.log('USDT deployed to:', usdtAddr);

  const Exchange = await ethers.getContractFactory('ExchangeV4');
  const proxy = await upgrades.deployProxy(Exchange, [phptAddr, usdtAddr]);
  const exchange = await proxy.deployed();

  await exchange.deployed();
  console.log('Exchange deployed to:', exchange.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
