// Hardhat configuration for deploying to Hedera testnet (or other EVM-compatible testnet)
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    compilers: [
      { version: "0.8.19" },
      { version: "0.8.28" }
    ]
  },
  networks: {
    hedera: {
      url: "https://testnet.hashio.io/api",
      accounts: ["0xd0280039d5b212bb80acb047724c991c68a53236c4643d48ed0b0f4ef0790f01"]
    }
  }
};
