import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import { HDNodeWallet } from "ethers";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";

import "./tasks/airdrop";

dotenv.config();

const mnemonic: string = process.env.MNEMONIC!;
const wallet = HDNodeWallet.fromPhrase(mnemonic);
console.log("ADMIN WALLET ADDRESS", wallet.address);

const chainIds = {
  "berachain-testnet": 80069,
  "berachain-mainnet": 80094,
  ganache: 1337,
  hardhat: 31337,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case "berachain-mainnet":
      jsonRpcUrl = "https://summer-frosty-choice.bera-mainnet.quiknode.pro/66d5d7779083aa80c958aa1f7ddedb2c752be67b";
      break;
    case "berachain-testnet":
      jsonRpcUrl = "https://bepolia.rpc.berachain.com/";
      break;
    default:
      throw new Error(`No JSON RPC URL for chain: ${chain}`);
  }
  return {
    accounts: {
      count: 10,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      "berachain-mainnet": process.env.BERASCAN_API_KEY!,
    },
    customChains: [
      {
        network: "berachain-mainnet",
        chainId: 80094,
        urls: {
          apiURL: "https://api.berascan.com/api",
          browserURL: "https://berascan.com",
        },
      },
    ],
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
    token: "ETH",
    gasPrice: 1.3, // Gwei
    coinmarketcap: "2ff90ab8-eafe-43d7-8ba5-ac9086d7f327",
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
      allowBlocksWithSameTimestamp: true,
    },
    ganache: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.ganache,
      url: "http://localhost:8545",
    },
    "berachain-testnet": getChainConfig("berachain-testnet"),
    "berachain-mainnet": getChainConfig("berachain-mainnet"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
  contractSizer: {
    disambiguatePaths: false,
  },
};

export default config;
