import { ethers } from 'hardhat';
// eslint-disable-next-line node/no-missing-import
import { toTokens } from '../helpers';

async function main() {
  const contractAddress = process.env.PROXY_DEPLOYED;
  if (!contractAddress) {
    throw Error('Please specify a contract address');
  }
  const exchange = await ethers.getContractAt('ExchangeV4', contractAddress);
  console.log('Exchange deployed to:', exchange.address);

  await exchange.setUsdtToPhptStandartRateInWei(toTokens(55.12));
  console.log('setUsdtToPhptStandartRateInWei', 'done');
  await exchange.setPhptToUsdtStandartRateInWei(toTokens(1 / 55.12));
  console.log('setPhptToUsdtStandartRateInWei', 'done');
  await exchange.setPhptToUsdtBulkCoefficient('99');
  console.log('BulkCoefficient2', 'done');
  await exchange.setUsdtToPhptBulkCoefficient('101');
  console.log('BulkCoefficient1', 'done');
  await exchange.setUsdtToPhptThresholdInWei(toTokens(5000));
  console.log('setUsdtToPhptThresholdInWei', 'done');
  await exchange.setPhptToUsdtThresholdInWei(toTokens(250000));
  console.log('setPhptToUsdtThresholdInWei', 'done');
  await exchange.setUsdtMinimalExchangeThresholdInWei(toTokens(5));
  console.log('setUsdtMinimalExchangeThresholdInWei', 'done');
  await exchange.setPhptMinimalExchangeThresholdInWei(toTokens(250));
  console.log('setPhptMinimalExchangeThresholdInWei', 'done');

  console.log('Default variables setting done');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
