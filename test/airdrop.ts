import { expect } from "chai";
import { solidityPackedKeccak256 } from "ethers";
import { ethers } from "hardhat";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";

import { Airdrop, ERC20Mock } from "../types";

describe("Airdrop Contract", function () {
  let airdrop: Airdrop;
  let token: ERC20Mock;
  let tree: MerkleTree;
  let merkleRoot: string;

  let owner: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let ALICE: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let BOB: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  beforeEach(async function () {
    [owner, ALICE, BOB] = await ethers.getSigners();

    // Deploy mock token
    const Token = await ethers.getContractFactory("ERC20Mock");
    token = (await Token.deploy("TestToken", "TTK", owner.address, ethers.parseEther("1000"))) as ERC20Mock;
    await token.waitForDeployment();

    // Deploy Airdrop
    const AirdropFactory = await ethers.getContractFactory("Airdrop");
    airdrop = (await AirdropFactory.deploy(owner.address)) as Airdrop;
    await airdrop.waitForDeployment();

    // ----- Prepare Merkle Tree -----
    const elements = [
      { account: ALICE.address, amount: ethers.parseEther("10") },
      { account: BOB.address, amount: ethers.parseEther("20") },
    ];

    const leaves = elements.map((e) => solidityPackedKeccak256(["address", "uint256"], [e.account, e.amount]));

    tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    merkleRoot = tree.getHexRoot();

    // Approve tokens for Airdrop contract
    await token.approve(await airdrop.getAddress(), ethers.parseEther("50"));

    // Create campaign
    await airdrop.createCampaign(
      await token.getAddress(),
      merkleRoot,
      ethers.parseEther("50"),
      3600, // 1h
      "Merkle Campaign",
    );
  });

  it("Should fail with invalid proof", async function () {
    const amount = ethers.parseEther("10");

    // Fake proof (empty array)
    await expect(airdrop.connect(ALICE).claim(0, amount, [])).to.be.revertedWith("Invalid proof");
  });

  it("Should fail if ALICE tries to claim more than allocated", async function () {
    const amount = ethers.parseEther("31");
    const leaf = solidityPackedKeccak256(["address", "uint256"], [ALICE.address, amount]);
    const proof = tree.getHexProof(Buffer.from(leaf.slice(2), "hex"));
    await expect(airdrop.connect(ALICE).claim(0, amount, proof)).to.be.revertedWith("Invalid proof");
  });

  it("ALICE should claim 10 tokens with valid proof", async function () {
    const amount = ethers.parseEther("10");

    const leaf = solidityPackedKeccak256(["address", "uint256"], [ALICE.address, amount]);

    const proof = tree.getHexProof(Buffer.from(leaf.slice(2), "hex"));

    await expect(airdrop.connect(ALICE).claim(0, amount, proof))
      .to.emit(airdrop, "TokensClaimed")
      .withArgs(0, ALICE.address, amount);

    const balance = await token.balanceOf(ALICE.address);
    expect(balance).to.equal(amount);
  });

  it("BOB should claim 20 tokens with valid proof", async function () {
    const amount = ethers.parseEther("20");

    const leaf = solidityPackedKeccak256(["address", "uint256"], [BOB.address, amount]);

    const proof = tree.getHexProof(Buffer.from(leaf.slice(2), "hex"));

    await expect(airdrop.connect(BOB).claim(0, amount, proof))
      .to.emit(airdrop, "TokensClaimed")
      .withArgs(0, BOB.address, amount);

    const balance = await token.balanceOf(BOB.address);
    expect(balance).to.equal(amount);
  });

  it("Should fail if ALICE tries to claim twice", async function () {
    const amount = ethers.parseEther("10");
    const leaf = solidityPackedKeccak256(["address", "uint256"], [ALICE.address, amount]);
    const proof = tree.getHexProof(Buffer.from(leaf.slice(2), "hex"));
    await airdrop.connect(ALICE).claim(0, amount, proof);
    await expect(airdrop.connect(ALICE).claim(0, amount, proof)).to.be.revertedWith("Already claimed");
  });
});
