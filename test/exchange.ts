/* eslint-disable no-unused-vars */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
// eslint-disable-next-line node/no-missing-import
import { ExchangeV4, Token } from '../typechain';
// eslint-disable-next-line node/no-missing-import
import { toTokens } from '../helpers';
import { utils } from 'ethers';

describe('Exchange', function () {
  let owner: SignerWithAddress;
  let phptWhale: SignerWithAddress;
  let usdtWhale: SignerWithAddress;
  let watcher: SignerWithAddress;
  let anyone: SignerWithAddress;
  let exchange: ExchangeV4;
  let phpt: Token;
  let usdt: Token;

  enum Tokens {
    PHPT,
    USDT,
  }

  before(async () => {
    [owner, phptWhale, usdtWhale, watcher, anyone] = await ethers.getSigners();

    phpt = await (await ethers.getContractFactory('Token'))
      .connect(phptWhale)
      .deploy('PHPT', 'PHPT', toTokens(10000000000000));
    usdt = await (await ethers.getContractFactory('Token'))
      .connect(usdtWhale)
      .deploy('USDT', 'USDT', toTokens(10000000000000));
  });

  beforeEach(async () => {
    // exchange = await (await ethers.getContractFactory('Exchange')).deploy(phpt.address, usdt.address);
    exchange = await deployProxy();
  });

  const deployProxy = async (): Promise<ExchangeV4> => {
    const Exchange = await ethers.getContractFactory('ExchangeV4');
    // const ExchangeV2 = await ethers.getContractFactory('ExchangeV4');

    const proxy = await upgrades.deployProxy(Exchange, [phpt.address, usdt.address]);
    // const upgraded = await upgrades.upgradeProxy(proxy.address, ExchangeV2);

    // @ts-ignore
    return proxy;
  };

  // TODO: add typechain generation before tests

  // TODO: add tests for pause

  describe('exchange process', async () => {
    // Setup
    beforeEach(async () => {
      // Setup
      const rate = {
        PHPTUSDT: {
          standart: toTokens(1.1),
          bulk: 99,
          threshold: toTokens(100),
          minimalExchangeThreshold: toTokens(5),
        },
        USDTPHPT: {
          standart: toTokens(0.9),
          bulk: 101,
          threshold: toTokens(1000),
          minimalExchangeThreshold: toTokens(1),
        },
      };

      await exchange.setPhptToUsdtThresholdInWei(rate.PHPTUSDT.threshold);
      await exchange.setPhptToUsdtStandartRateInWei(rate.PHPTUSDT.standart);
      await exchange.setBothUsdtPhptStandartRateInWei(rate.USDTPHPT.standart, rate.PHPTUSDT.standart);
      await exchange.setPhptToUsdtBulkCoefficient(rate.PHPTUSDT.bulk);
      await exchange.setUsdtToPhptThresholdInWei(rate.USDTPHPT.threshold);
      await exchange.setUsdtToPhptStandartRateInWei(rate.USDTPHPT.standart);
      await exchange.setUsdtToPhptBulkCoefficient(rate.USDTPHPT.bulk);
   
      await exchange.setPhptMinimalExchangeThresholdInWei(rate.PHPTUSDT.minimalExchangeThreshold);
      await exchange.setUsdtMinimalExchangeThresholdInWei(rate.USDTPHPT.minimalExchangeThreshold);
    });

    it('error: not enough allowance', async () => {
      await expect(exchange.connect(owner).exchange(Tokens.PHPT, toTokens(5))).to.be.revertedWith(
        'Exchange: not enough allowance'
      );
      await expect(exchange.connect(owner).exchange(Tokens.USDT, toTokens(1))).to.be.revertedWith(
        'Exchange: not enough allowance'
      );
    });

    it('error: minimal exchange threshold', async () => {
      await expect(exchange.connect(owner).exchange(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: amount in must be greater than minimal exchange threshold'
      );
      await expect(exchange.connect(owner).exchange(Tokens.USDT, toTokens(0.5))).to.be.revertedWith(
        'Exchange: amount in must be greater than minimal exchange threshold'
      );
    });

    it('error: not enough liquidity', async () => {
      // PHPT/USDT
      await phpt.connect(owner).approve(exchange.address, toTokens(10));
      expect(await phpt.allowance(owner.address, exchange.address)).to.equal(toTokens(10));
      await expect(exchange.connect(owner).exchange(Tokens.PHPT, toTokens(10))).to.be.revertedWith(
        'Exchange: not enough liquidity'
      );

      // USDT/PHPT
      await usdt.connect(owner).approve(exchange.address, toTokens(10));
      expect(await usdt.allowance(owner.address, exchange.address)).to.equal(toTokens(10));
      await expect(exchange.connect(owner).exchange(Tokens.USDT, toTokens(10))).to.be.revertedWith(
        'Exchange: not enough liquidity'
      );
    });

    // PHPT/USDT
    it('phpt to usdt', async () => {
      const amountIn = 10;
      const amountInBN = toTokens(amountIn);
      await phpt.connect(phptWhale).transfer(owner.address, amountInBN);
      await phpt.connect(owner).approve(exchange.address, amountInBN);
      await usdt.connect(usdtWhale).transfer(exchange.address, toTokens(100000000000));

      const exchangeRateBN = await exchange.getExchangeRate(Tokens.PHPT, amountInBN);
      const exchangeRate = parseFloat(utils.formatEther(exchangeRateBN));
      const amountOut = toTokens(amountIn * exchangeRate);

      const ownerPhptBefore = await phpt.balanceOf(owner.address);
      await expect(() => exchange.connect(owner).exchange(Tokens.PHPT, amountInBN)).to.changeTokenBalance(
        usdt,
        owner,
        amountOut
      );
      const ownerPhptAfter = await phpt.balanceOf(owner.address);
      expect(ownerPhptBefore.sub(ownerPhptAfter)).to.equal(amountInBN);
    });

    // USDT/PHPT
    it('usdt to phpt', async () => {
      const amountIn = 10;
      const amountInBN = toTokens(amountIn);
      await usdt.connect(usdtWhale).transfer(owner.address, amountInBN);
      await usdt.connect(owner).approve(exchange.address, amountInBN);
      await phpt.connect(owner).connect(phptWhale).transfer(exchange.address, toTokens(20));

      const exchangeRateBN = await exchange.getExchangeRate(Tokens.USDT, amountInBN);
      const exchangeRate = parseFloat(utils.formatEther(exchangeRateBN));
      const amountOut = toTokens(amountIn * exchangeRate);

      const ownerUsdtBefore = await usdt.balanceOf(owner.address);
      await expect(() => exchange.connect(owner).exchange(Tokens.USDT, amountInBN)).to.changeTokenBalance(
        phpt,
        owner,
        amountOut
      );
      const ownerUsdtAfter = await usdt.balanceOf(owner.address);
      expect(ownerUsdtBefore.sub(ownerUsdtAfter)).to.equal(amountInBN);
    });

    // USDT/PHPT
    it('Not allow deposit if oracle update usdt to phpt', async () => {
      await ethers.provider.send('evm_increaseTime', [80000]);
      await ethers.provider.send('evm_mine', []);
      //await exchange.setUsdtToPhptStandartRateInWei(toTokens(1.1));
      const amountIn = 10;
      const amountInBN = toTokens(amountIn);
      await usdt.connect(usdtWhale).transfer(owner.address, amountInBN);
      await usdt.connect(owner).approve(exchange.address, amountInBN);
      await phpt.connect(owner).connect(phptWhale).transfer(exchange.address, toTokens(20));

      const exchangeRateBN = await exchange.getExchangeRate(Tokens.USDT, amountInBN);
      const exchangeRate = parseFloat(utils.formatEther(exchangeRateBN));
      const amountOut = toTokens(amountIn * exchangeRate);

      const ownerUsdtBefore = await usdt.balanceOf(owner.address);
      await expect(() => exchange.connect(owner).exchange(Tokens.USDT, amountInBN));
      await expect(exchange.connect(owner).exchange(Tokens.USDT, amountInBN)).to.be.revertedWith('Exchange not allow');
      //   const ownerUsdtAfter = await usdt.balanceOf(owner.address);
      // expect(ownerUsdtBefore.sub(ownerUsdtAfter)).to.equal(amountInBN);
    });
  });

  describe('see exchange result', () => {
    beforeEach(async () => {
      // Setup
      const rate = {
        PHPTUSDT: {
          standart: toTokens(1.1),
          bulk: 99,
          threshold: toTokens(100),
        },
        USDTPHPT: {
          standart: toTokens(0.9),
          bulk: 101,
          threshold: toTokens(1000),
        },
      };

      await exchange.setPhptToUsdtThresholdInWei(rate.PHPTUSDT.threshold);
      await exchange.setPhptToUsdtStandartRateInWei(rate.PHPTUSDT.standart);
      await exchange.setPhptToUsdtBulkCoefficient(rate.PHPTUSDT.bulk);
      await exchange.setUsdtToPhptThresholdInWei(rate.USDTPHPT.threshold);
      await exchange.setUsdtToPhptStandartRateInWei(rate.USDTPHPT.standart);
      await exchange.setUsdtToPhptBulkCoefficient(rate.USDTPHPT.bulk);
    });

    it('success phpt to usdt', async () => {
      const amountIn = 10;
      const amountInBN = toTokens(amountIn);
      await phpt.connect(owner).approve(exchange.address, amountInBN);
      await usdt.connect(usdtWhale).transfer(exchange.address, toTokens(20));
      const exchangeRes = await exchange.connect(owner).callStatic.seeExchangeResult(Tokens.PHPT, amountInBN);
      const exchangeRateBN = await exchange.getExchangeRate(Tokens.PHPT, amountInBN);
      const exchangeRate = parseFloat(utils.formatEther(exchangeRateBN));
      const amountOut = toTokens(amountIn * exchangeRate);
      expect(exchangeRes).to.equal(amountOut);
    });

    it('success usdt to phpt', async () => {
      const amountIn = 10;
      const amountInBN = toTokens(amountIn);
      await usdt.connect(owner).approve(exchange.address, amountInBN);
      await phpt.connect(phptWhale).transfer(exchange.address, toTokens(20));
      const exchangeRes = await exchange.connect(owner).callStatic.seeExchangeResult(Tokens.USDT, amountInBN);
      const exchangeRateBN = await exchange.getExchangeRate(Tokens.USDT, amountInBN);
      const exchangeRate = parseFloat(utils.formatEther(exchangeRateBN));
      const amountOut = toTokens(amountIn * exchangeRate);
      expect(exchangeRes).to.equal(amountOut);
    });
  });

  describe('get exchange rate', () => {
    it('errors', async () => {
      // 1
      await expect(exchange.getExchangeRate(Tokens.PHPT, 0)).to.be.revertedWith('Exchange: amount should be non-zero');

      // 2
      await expect(exchange.getExchangeRate(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: phpt/usdt threshold not set'
      );

      // 3
      await exchange.setPhptToUsdtThresholdInWei(toTokens(10));
      await expect(exchange.getExchangeRate(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: usdt/phpt threshold not set'
      );

      // 4
      await exchange.setUsdtToPhptThresholdInWei(toTokens(10));
      await expect(exchange.getExchangeRate(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: phpt/usdt standart rate not set'
      );

      // 5
      await exchange.setPhptToUsdtStandartRateInWei(toTokens(10));
      await expect(exchange.getExchangeRate(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: phpt/usdt bulk rate not set'
      );

      // 6
      await exchange.setPhptToUsdtBulkCoefficient(99);
      await expect(exchange.getExchangeRate(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: usdt/phpt standart rate not set'
      );

      // 7
      await exchange.setUsdtToPhptStandartRateInWei(toTokens(10));
      await expect(exchange.getExchangeRate(Tokens.PHPT, toTokens(1))).to.be.revertedWith(
        'Exchange: usdt/phpt bulk rate not set'
      );
    });

    it('success', async () => {
      const rate = {
        PHPTUSDT: {
          standart: toTokens(1.1),
          bulk: 99,
          threshold: toTokens(100),
        },
        USDTPHPT: {
          standart: toTokens(0.9),
          bulk: 101,
          threshold: toTokens(1000),
        },
      };

      await exchange.setPhptToUsdtThresholdInWei(rate.PHPTUSDT.threshold);
      await exchange.setPhptToUsdtStandartRateInWei(rate.PHPTUSDT.standart);
      await exchange.setPhptToUsdtBulkCoefficient(rate.PHPTUSDT.bulk);
      await exchange.setUsdtToPhptThresholdInWei(rate.USDTPHPT.threshold);
      await exchange.setUsdtToPhptStandartRateInWei(rate.USDTPHPT.standart);
      await exchange.setUsdtToPhptBulkCoefficient(rate.USDTPHPT.bulk);

      // PHPT
      let phptIn = rate.PHPTUSDT.threshold.sub(1);
      let exchangeRate = await exchange.callStatic.getExchangeRate(Tokens.PHPT, phptIn);
      expect(exchangeRate).to.equal(rate.PHPTUSDT.standart);

      phptIn = rate.PHPTUSDT.threshold;
      exchangeRate = await exchange.callStatic.getExchangeRate(Tokens.PHPT, phptIn);
      expect(exchangeRate).to.equal(rate.PHPTUSDT.standart);

      phptIn = rate.PHPTUSDT.threshold.add(1);
      exchangeRate = await exchange.callStatic.getExchangeRate(Tokens.PHPT, phptIn);
      expect(exchangeRate).to.equal(rate.PHPTUSDT.standart.mul(rate.PHPTUSDT.bulk).div(100));

      // USDT
      let usdtIn = rate.USDTPHPT.threshold.sub(1);
      exchangeRate = await exchange.callStatic.getExchangeRate(Tokens.USDT, usdtIn);
      expect(exchangeRate).to.equal(rate.USDTPHPT.standart);

      usdtIn = rate.USDTPHPT.threshold;
      exchangeRate = await exchange.callStatic.getExchangeRate(Tokens.USDT, usdtIn);
      expect(exchangeRate).to.equal(rate.USDTPHPT.standart);

      usdtIn = rate.USDTPHPT.threshold.add(1);
      exchangeRate = await exchange.callStatic.getExchangeRate(Tokens.USDT, usdtIn);
      expect(exchangeRate).to.equal(rate.USDTPHPT.standart.mul(rate.USDTPHPT.bulk).div(100));
    });
  });

  it('setPhptToUsdtStandartRateInWei', async () => {
    await expect(exchange.connect(anyone).setPhptToUsdtStandartRateInWei(toTokens(1))).to.be.revertedWith(
      'Exchange: caller is not the owner'
    );

    await expect(exchange.setPhptToUsdtStandartRateInWei(toTokens(0))).to.be.revertedWith(
      'Exchange: value should not be zero'
    );

    await exchange.setPhptToUsdtStandartRateInWei(toTokens(1.01));
    expect(await exchange.phptToUsdtStandartRateInWei()).to.equal(toTokens(1.01));

    await exchange.setPhptToUsdtStandartRateInWei(toTokens(2));
    expect(await exchange.phptToUsdtStandartRateInWei()).to.equal(toTokens(2));

    await exchange.setWatcher(watcher.address);
    await exchange.connect(watcher).setPhptToUsdtStandartRateInWei(toTokens(1));
    expect(await exchange.phptToUsdtStandartRateInWei()).to.equal(toTokens(1));
  });

  it('setUsdtToPhptStandartRateInWei', async () => {
    await expect(exchange.connect(anyone).setUsdtToPhptStandartRateInWei(toTokens(1))).to.be.revertedWith(
      'Exchange: caller is not the owner'
    );

    await expect(exchange.setUsdtToPhptStandartRateInWei(toTokens(0))).to.be.revertedWith(
      'Exchange: value should not be zero'
    );

    await exchange.setUsdtToPhptStandartRateInWei(toTokens(1.01));
    expect(await exchange.usdtToPhptStandartRateInWei()).to.equal(toTokens(1.01));

    await exchange.setUsdtToPhptStandartRateInWei(toTokens(2));
    expect(await exchange.usdtToPhptStandartRateInWei()).to.equal(toTokens(2));

    await exchange.setWatcher(watcher.address);
    await exchange.connect(watcher).setUsdtToPhptStandartRateInWei(toTokens(1));
    expect(await exchange.usdtToPhptStandartRateInWei()).to.equal(toTokens(1));
  });

  it('setPhptToUsdtThresholdInWei', async () => {
    await expect(exchange.connect(anyone).setPhptToUsdtThresholdInWei(toTokens(1))).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(exchange.setPhptToUsdtThresholdInWei(toTokens(0))).to.be.revertedWith(
      'Exchange: value should not be zero'
    );

    await exchange.setPhptToUsdtThresholdInWei(toTokens(1.01));
    expect(await exchange.phptToUsdtThresholdInWei()).to.equal(toTokens(1.01));

    await exchange.setPhptToUsdtThresholdInWei(toTokens(2));
    expect(await exchange.phptToUsdtThresholdInWei()).to.equal(toTokens(2));
  });

  it('setUsdtToPhptThresholdInWei', async () => {
    await expect(exchange.connect(anyone).setUsdtToPhptThresholdInWei(toTokens(1))).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(exchange.setUsdtToPhptThresholdInWei(toTokens(0))).to.be.revertedWith(
      'Exchange: value should not be zero'
    );

    await exchange.setUsdtToPhptThresholdInWei(toTokens(1.01));
    expect(await exchange.usdtToPhptThresholdInWei()).to.equal(toTokens(1.01));

    await exchange.setUsdtToPhptThresholdInWei(toTokens(2));
    expect(await exchange.usdtToPhptThresholdInWei()).to.equal(toTokens(2));
  });

  describe('add liquidity', () => {
    it('PHPT', async () => {
      await phpt.connect(phptWhale).transfer(exchange.address, toTokens(5));
      expect(await phpt.balanceOf(exchange.address)).to.equal(toTokens(5));
      await phpt.connect(phptWhale).transfer(exchange.address, toTokens(10));
      expect(await phpt.balanceOf(exchange.address)).to.equal(toTokens(15));
      await phpt.connect(phptWhale).transfer(exchange.address, toTokens(50));
      expect(await phpt.balanceOf(exchange.address)).to.equal(toTokens(65));
    });

    it('USDT', async () => {
      await usdt.connect(usdtWhale).transfer(exchange.address, toTokens(5));
      expect(await usdt.balanceOf(exchange.address)).to.equal(toTokens(5));
      await usdt.connect(usdtWhale).transfer(exchange.address, toTokens(10));
      expect(await usdt.balanceOf(exchange.address)).to.equal(toTokens(15));
      await usdt.connect(usdtWhale).transfer(exchange.address, toTokens(50));
      expect(await usdt.balanceOf(exchange.address)).to.equal(toTokens(65));
    });
  });

  describe('withdraw liquidity', () => {
    it('PHPT', async () => {
      await expect(exchange.connect(anyone).withdrawPhpt(toTokens(1))).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      const phptContractBal = await phpt.balanceOf(exchange.address);
      await expect(() => exchange.withdrawPhpt(phptContractBal)).to.changeTokenBalance(phpt, owner, phptContractBal);
    });

    it('USDT', async () => {
      await expect(exchange.connect(anyone).withdrawUsdt(toTokens(1))).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      const usdtContractBal = await usdt.balanceOf(exchange.address);
      await expect(() => exchange.withdrawUsdt(usdtContractBal)).to.changeTokenBalance(usdt, owner, usdtContractBal);
    });
  });

  describe('pausable', () => {
    it('Revert if contract is paused', async () => {
      await exchange.setPhptToUsdtThresholdInWei(100000);
      await exchange.pause();
      await expect(exchange.setPhptToUsdtThresholdInWei(100000)).to.be.revertedWith('Pausable: paused');
      await exchange.unpause();
      await exchange.setPhptToUsdtThresholdInWei(100000);
    });
  });
});
