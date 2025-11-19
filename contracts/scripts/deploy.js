// Deployment script for ResearchHub.sol using Hardhat

const { ethers } = require("hardhat");

async function main() {
  const ResearchHub = await ethers.getContractFactory("ResearchHub");
  const contract = await ResearchHub.deploy();
  await contract.waitForDeployment();
  console.log("ResearchHub deployed to:", contract.target);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
