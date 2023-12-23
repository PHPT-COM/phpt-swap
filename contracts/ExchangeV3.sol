// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import { PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract ExchangeV3 is PausableUpgradeable, OwnableUpgradeable {
    enum Tokens {
        PHPT,
        USDT
    }

    address public phptAddr;
    address public usdtAddr;

    uint256 public phptToUsdtThresholdInWei;
    uint256 public usdtToPhptThresholdInWei;
    uint256 public phptToUsdtStandartRateInWei;
    uint256 public phptToUsdtBulkRateInWei;
    uint256 public usdtToPhptStandartRateInWei;
    uint256 public usdtToPhptBulkRateInWei;

    uint256 public phptMinimalExchangeThresholdInWei; // minimal value to exchange, in wei
    uint256 public usdtMinimalExchangeThresholdInWei; // minimal value to exchange, in wei

    modifier nonZero(uint256 _value) {
        require(_value > 0, 'Exchange: value should not be zero');
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(address _phptAddr, address _usdtAddr) public initializer {
        __Pausable_init();
        __Ownable_init();
        phptAddr = _phptAddr;
        usdtAddr = _usdtAddr;
    }

    /**
     * Exchange one type of tokens to another
     * @param _tokenIn PHPT or USDT
     * @param _amountIn amount of tokens with 18 decimals
     */
    function exchange(Tokens _tokenIn, uint256 _amountIn) external whenNotPaused {
        uint256 _minimalAmountIn = getMinimalExchangeThreshold(_tokenIn);
        require(_amountIn >= _minimalAmountIn, 'Exchange: amount in must be greater than minimal exchange threshold');
        address _tokenInAddr = getTokenInAddr(_tokenIn);
        require(
            IERC20(_tokenInAddr).allowance(msg.sender, address(this)) >= _amountIn,
            'Exchange: not enough allowance'
        );
        address _tokenOutAddr = getTokenOutAddr(_tokenIn);
        uint256 _amountOut = seeExchangeResult(_tokenIn, _amountIn);
        require(IERC20(_tokenOutAddr).balanceOf(address(this)) >= _amountOut, 'Exchange: not enough liquidity');
        IERC20(_tokenInAddr).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenOutAddr).transfer(msg.sender, _amountOut);
    }

    function getTokenOutAddr(Tokens _tokenIn) internal view returns (address) {
        if (_tokenIn == Tokens.PHPT) return usdtAddr;
        if (_tokenIn == Tokens.USDT) return phptAddr;
        revert('Exchange: was not found out address for such token');
    }

    function getTokenInAddr(Tokens _tokenIn) internal view returns (address) {
        if (_tokenIn == Tokens.PHPT) return phptAddr;
        if (_tokenIn == Tokens.USDT) return usdtAddr;
        revert('Exchange: was not found in address for such token');
    }

    function getMinimalExchangeThreshold(Tokens _tokenIn) internal view returns (uint256) {
        if (_tokenIn == Tokens.PHPT) {
            require(phptMinimalExchangeThresholdInWei > 0, 'Exchange: phpt minimal exchange threshold not set');
            return phptMinimalExchangeThresholdInWei;
        }
        if (_tokenIn == Tokens.USDT) {
            require(usdtMinimalExchangeThresholdInWei > 0, 'Exchange: usdt minimal exchange threshold not set');
            return usdtMinimalExchangeThresholdInWei;
        }
        revert('Exchange: was not found minimal exchange threshold for such token');
    }

    /**
     * See exchange result without actually exectuting the exchange
     * @param _tokenIn PHPT or USDT
     * @param _amountIn amount of tokens with 18 decimals
     * @return _amountOut the amount of tokens that the user will receive as output
     */
    function seeExchangeResult(Tokens _tokenIn, uint256 _amountIn)
        public
        view
        whenNotPaused
        returns (uint256 _amountOut)
    {
        uint256 _exchangeRate = getExchangeRate(_tokenIn, _amountIn);
        _amountOut = (_amountIn * _exchangeRate) / 1e18;
    }

    /**
     * Get exchange rate of PHPT/USDT or USDT/PHPT
     * @param _tokenIn PHPT or USDT
     * @param _amountIn amount of tokens with 18 decimals
     * @return _exchangeRate the exchange rate for the given token and amount
     */
    function getExchangeRate(Tokens _tokenIn, uint256 _amountIn)
        public
        view
        whenNotPaused
        returns (uint256 _exchangeRate)
    {
        require(_amountIn > 0, 'Exchange: amount should be non-zero');
        require(phptToUsdtThresholdInWei > 0, 'Exchange: phpt/usdt threshold not set');
        require(usdtToPhptThresholdInWei > 0, 'Exchange: usdt/phpt threshold not set');
        require(phptToUsdtStandartRateInWei > 0, 'Exchange: phpt/usdt standart rate not set');
        require(phptToUsdtBulkRateInWei > 0, 'Exchange: phpt/usdt bulk rate not set');
        require(usdtToPhptStandartRateInWei > 0, 'Exchange: usdt/phpt standart rate not set');
        require(usdtToPhptBulkRateInWei > 0, 'Exchange: usdt/phpt bulk rate not set');

        if (_tokenIn == Tokens.PHPT) {
            if (_amountIn <= phptToUsdtThresholdInWei) {
                _exchangeRate = phptToUsdtStandartRateInWei;
            } else {
                _exchangeRate = phptToUsdtBulkRateInWei;
            }
        } else {
            // USDT
            if (_amountIn <= usdtToPhptThresholdInWei) {
                _exchangeRate = usdtToPhptStandartRateInWei;
            } else {
                _exchangeRate = usdtToPhptBulkRateInWei;
            }
        }
    }

    function setPhptToUsdtThresholdInWei(uint256 _threshold) public nonZero(_threshold) whenNotPaused onlyOwner {
        phptToUsdtThresholdInWei = _threshold;
    }

    function setUsdtToPhptThresholdInWei(uint256 _threshold) public nonZero(_threshold) whenNotPaused onlyOwner {
        usdtToPhptThresholdInWei = _threshold;
    }

    function setPhptMinimalExchangeThresholdInWei(uint256 _threshold)
        public
        nonZero(_threshold)
        whenNotPaused
        onlyOwner
    {
        phptMinimalExchangeThresholdInWei = _threshold;
    }

    function setUsdtMinimalExchangeThresholdInWei(uint256 _threshold)
        public
        nonZero(_threshold)
        whenNotPaused
        onlyOwner
    {
        usdtMinimalExchangeThresholdInWei = _threshold;
    }

    function setPhptToUsdtStandartRateInWei(uint256 _rate) public nonZero(_rate) whenNotPaused onlyOwner {
        phptToUsdtStandartRateInWei = _rate;
    }

    function setPhptToUsdtBulkRateInWei(uint256 _rate) public nonZero(_rate) whenNotPaused onlyOwner {
        phptToUsdtBulkRateInWei = _rate;
    }

    function setUsdtToPhptStandartRateInWei(uint256 _rate) public nonZero(_rate) whenNotPaused onlyOwner {
        usdtToPhptStandartRateInWei = _rate;
    }

    function setUsdtToPhptBulkRateInWei(uint256 _rate) public nonZero(_rate) whenNotPaused onlyOwner {
        usdtToPhptBulkRateInWei = _rate;
    }

    function withdrawPhpt(uint256 _amount) public onlyOwner {
        IERC20(phptAddr).transfer(owner(), _amount);
    }

    function withdrawUsdt(uint256 _amount) public onlyOwner {
        IERC20(usdtAddr).transfer(owner(), _amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
