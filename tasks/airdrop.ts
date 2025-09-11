import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("task:deploy", "Deploys Contract").setAction(
  async (taskArgs: { network?: string }, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre;

    console.log(
      `\u001b[1;34mStarting deployment of Airdrop Tools on "${network.name}", chainId "${network.config.chainId}"...\u001b[1;32m`,
    );

    const [deployer] = await ethers.getSigners();

    const Airdrop = await ethers.getContractFactory("Airdrop");
    const airdrop = await Airdrop.deploy(deployer.address);
    await airdrop.waitForDeployment();

    console.log(`ADMIN:\t ${deployer.address}`);
    console.log(`DEPLOYER:\t ${deployer.address}`);
    console.log(`AIRDROP:\t ${await airdrop.getAddress()}`);

    return airdrop.getAddress();
  },
);
