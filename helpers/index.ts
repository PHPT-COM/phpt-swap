import { ethers } from 'hardhat';

export const toTokens = (x: number) => ethers.utils.parseEther(x.toString());
